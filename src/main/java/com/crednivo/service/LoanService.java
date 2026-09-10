package com.crednivo.service;

import com.crednivo.dto.IoLoanExtensionRequest;
import com.crednivo.dto.IoSettlementPreviewResponse;
import com.crednivo.dto.LoanEditRequest;
import com.crednivo.dto.LoanPreviewResponse;
import com.crednivo.dto.LoanRequest;
import com.crednivo.dto.LoanResponse;
import com.crednivo.entity.CollectionEntry;
import com.crednivo.entity.Customer;
import com.crednivo.entity.Loan;
import com.crednivo.entity.Payment;
import com.crednivo.enums.*;
import com.crednivo.exception.BadRequestException;
import com.crednivo.exception.NotFoundException;
import com.crednivo.repository.CollectionEntryRepository;
import com.crednivo.repository.CustomerRepository;
import com.crednivo.repository.LoanRepository;
import com.crednivo.repository.PaymentRepository;
import com.crednivo.util.DateUtil;
import com.crednivo.util.MoneyUtil;
import com.crednivo.util.StatusUtil;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

@Service
public class LoanService {
    private final LoanRepository loanRepository;
    private final CustomerRepository customerRepository;
    private final CollectionEntryRepository collectionRepository;
    private final PaymentRepository paymentRepository;
    private final CustomerService customerService;
    private final LoanCalculatorService calculator;
    private final TenantService tenant;

    public LoanService(LoanRepository loanRepository, CustomerRepository customerRepository,
                       CollectionEntryRepository collectionRepository, PaymentRepository paymentRepository,
                       CustomerService customerService, LoanCalculatorService calculator, TenantService tenant) {
        this.loanRepository = loanRepository;
        this.customerRepository = customerRepository;
        this.collectionRepository = collectionRepository;
        this.paymentRepository = paymentRepository;
        this.customerService = customerService;
        this.calculator = calculator;
        this.tenant = tenant;
    }

    @Transactional
    public List<LoanResponse> list() {
        return loanRepository.findByCompanyDbIdOrderByDbIdDesc(tenant.companyId()).stream()
            .map(this::ensureCurrentIoPolicy)
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public LoanResponse get(String loanId) { return toResponse(requireLoan(loanId)); }

    public LoanPreviewResponse preview(LoanRequest request) {
        return calculator.calculate(request.amount(), request.cycle(), request.loanType(), request.interestRate(), request.duration(), request.interestUpfront());
    }

    @Transactional
    public String nextLoanIdPreview() {
        return nextLoanId(tenant.companyId());
    }

    @Transactional
    public LoanResponse create(LoanRequest request) {
        if (request.customerId() == null || request.customerId().isBlank()) throw new BadRequestException("Select a customer");
        Customer customer = customerService.requireCustomer(request.customerId());
        LoanCycle cycle = LoanCycle.from(request.cycle());
        LoanType type = LoanType.from(request.loanType());
        LoanPreviewResponse terms = preview(request);
        if (terms.principal().compareTo(BigDecimal.ZERO) <= 0) throw new BadRequestException("Loan amount must be greater than zero");
        if (request.startDate().isAfter(LocalDate.now())) throw new BadRequestException("Disbursed date cannot be in the future");

        Loan loan = new Loan();
        loan.setCompanyDbId(tenant.companyId());
        loan.setCustomer(customer);
        loan.setCycle(cycle);
        loan.setLoanType(type);
        loan.setPrincipal(terms.principal());
        loan.setDisbursedAmount(terms.disbursedAmount());
        loan.setInterestRate(request.interestRate());
        loan.setInterestAmount(terms.interestAmount());
        loan.setTotalInterest(terms.totalInterest());
        loan.setTotalRepayment(terms.totalRepayment());
        loan.setCollectionAmount(terms.collectionAmount());
        loan.setOutstanding(terms.initialOutstanding());
        loan.setPrincipalOutstanding(terms.principalOutstanding());
        loan.setDuration(terms.duration());
        loan.setStartDate(request.startDate());
        loan.setStatus(LoanStatus.ACTIVE);
        loan.setInterestUpfront(Boolean.TRUE.equals(request.interestUpfront()));

        boolean fineEnabled = Boolean.TRUE.equals(request.fineEnabled());
        BigDecimal configuredFine = request.fineAmount() == null ? MoneyUtil.ZERO : MoneyUtil.nonNegative(request.fineAmount());
        if (fineEnabled && configuredFine.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Fine amount must be greater than zero when Fine is enabled");
        }
        loan.setFineEnabled(fineEnabled);
        loan.setFineAmount(fineEnabled ? MoneyUtil.money(configuredFine) : MoneyUtil.ZERO);

        boolean documentChargeEnabled = Boolean.TRUE.equals(request.documentChargeEnabled());
        BigDecimal configuredDocumentCharge = request.documentChargeAmount() == null
            ? MoneyUtil.ZERO
            : MoneyUtil.nonNegative(request.documentChargeAmount());
        if (documentChargeEnabled && configuredDocumentCharge.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Document Charges amount must be greater than zero when Document Charges is enabled");
        }
        loan.setDocumentChargeEnabled(documentChargeEnabled);
        loan.setDocumentChargeAmount(documentChargeEnabled ? MoneyUtil.money(configuredDocumentCharge) : MoneyUtil.ZERO);

        loan = loanRepository.save(loan);
        loan.setLoanId(nextLoanId(loan.getCompanyDbId()));
        loan = loanRepository.save(loan);

        createSchedule(loan);

        List<CollectionEntry> schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);
        loan.setNextDueDate(schedule.stream()
            .filter(e -> e.getStatus() != CollectionStatus.CANCELLED && e.getStatus() != CollectionStatus.PAID)
            .map(CollectionEntry::getDueDate).min(LocalDate::compareTo).orElse(null));
        loan = loanRepository.save(loan);

        Payment disbursement = new Payment();
        disbursement.setCompanyDbId(tenant.companyId());
        disbursement.setType(PaymentType.NEW_LOAN);
        disbursement.setDirection(Direction.OUT);
        disbursement.setCustomer(customer);
        disbursement.setLoan(loan);
        disbursement.setCycle(cycle);
        disbursement.setLoanType(type);
        disbursement.setAmount(terms.disbursedAmount());
        disbursement.setCollectionAmount(BigDecimal.ZERO);
        disbursement.setInterestPaid(BigDecimal.ZERO);
        disbursement.setPrincipalPaid(BigDecimal.ZERO);
        disbursement.setFineAmount(BigDecimal.ZERO);
        disbursement.setPaymentDate(request.startDate());
        disbursement.setReferenceId(loan.getLoanId());
        disbursement.setPaymentMode("Disbursement");
        disbursement.setNote(cycle.label() + " " + type.name() + " loan disbursement");
        disbursement = paymentRepository.save(disbursement);
        disbursement.setPaymentId("PAY-" + String.format("%06d", disbursement.getDbId()));
        paymentRepository.save(disbursement);

        syncDocumentChargePayment(loan);

        customer.setStatus("Active");
        customerRepository.save(customer);
        return toResponse(loan);
    }

    /**
     * Owner-only correction of a loan.
     *
     * Accounting safety rule:
     * - Before the first COLLECTION payment, core loan terms may be corrected and
     *   the unpaid schedule + original disbursement transaction are rebuilt.
     * - After a collection exists (or an IO extension exists), core financial
     *   terms are immutable. Only future fine configuration may be changed.
     * - Closed loans are never editable.
     */
    @Transactional
    public LoanResponse update(String loanId, LoanEditRequest request) {
        Loan loan = requireLoan(loanId);
        if (loan.getStatus() == LoanStatus.CLOSED) {
            throw new BadRequestException("Closed loans cannot be edited");
        }

        LoanCycle requestedCycle = LoanCycle.from(request.cycle());
        LoanType requestedType = LoanType.from(request.loanType());
        LoanPreviewResponse terms = calculator.calculate(
            request.amount(), request.cycle(), request.loanType(), request.interestRate(),
            request.duration(), request.interestUpfront()
        );

        if (terms.principal().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Loan amount must be greater than zero");
        }
        if (request.startDate().isAfter(LocalDate.now())) {
            throw new BadRequestException("Disbursed date cannot be in the future");
        }

        boolean fineEnabled = Boolean.TRUE.equals(request.fineEnabled());
        BigDecimal configuredFine = request.fineAmount() == null
            ? MoneyUtil.ZERO
            : MoneyUtil.nonNegative(request.fineAmount());
        if (fineEnabled && configuredFine.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Fine amount must be greater than zero when Fine is enabled");
        }

        boolean documentChargeEnabled = Boolean.TRUE.equals(request.documentChargeEnabled());
        BigDecimal configuredDocumentCharge = request.documentChargeAmount() == null
            ? MoneyUtil.ZERO
            : MoneyUtil.nonNegative(request.documentChargeAmount());
        if (documentChargeEnabled && configuredDocumentCharge.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Document Charges amount must be greater than zero when Document Charges is enabled");
        }

        boolean hasCollectionHistory = paymentRepository.findByLoanOrderByPaymentDateDesc(loan).stream()
            .anyMatch(payment -> payment.getType() == PaymentType.COLLECTION);
        boolean hasExtensionHistory = loan.getExtensionCycles() != null && loan.getExtensionCycles() > 0;

        boolean coreTermsChanged =
            loan.getPrincipal().compareTo(MoneyUtil.money(terms.principal())) != 0
            || loan.getCycle() != requestedCycle
            || loan.getLoanType() != requestedType
            || loan.getInterestRate().compareTo(request.interestRate()) != 0
            || !loan.getDuration().equals(terms.duration())
            || loan.isInterestUpfront() != Boolean.TRUE.equals(request.interestUpfront())
            || !loan.getStartDate().equals(request.startDate());

        if ((hasCollectionHistory || hasExtensionHistory) && coreTermsChanged) {
            throw new BadRequestException(
                hasCollectionHistory
                    ? "Loan terms cannot be changed after a collection has been recorded. Only fine and document charge settings can be edited."
                    : "Loan terms cannot be changed after an IO extension. Only fine and document charge settings can be edited."
            );
        }

        // Fine and one-time document charge configuration are safe to correct
        // at any point while the loan is open. Document Charges are income only
        // and never alter principal, repayment, collection or outstanding.
        loan.setFineEnabled(fineEnabled);
        loan.setFineAmount(fineEnabled ? MoneyUtil.money(configuredFine) : MoneyUtil.ZERO);
        loan.setDocumentChargeEnabled(documentChargeEnabled);
        loan.setDocumentChargeAmount(documentChargeEnabled ? MoneyUtil.money(configuredDocumentCharge) : MoneyUtil.ZERO);

        if (coreTermsChanged) {
            loan.setCycle(requestedCycle);
            loan.setLoanType(requestedType);
            loan.setPrincipal(MoneyUtil.money(terms.principal()));
            loan.setDisbursedAmount(MoneyUtil.money(terms.disbursedAmount()));
            loan.setInterestRate(request.interestRate());
            loan.setInterestAmount(MoneyUtil.money(terms.interestAmount()));
            loan.setTotalInterest(MoneyUtil.money(terms.totalInterest()));
            loan.setTotalRepayment(MoneyUtil.money(terms.totalRepayment()));
            loan.setCollectionAmount(MoneyUtil.money(terms.collectionAmount()));
            loan.setOutstanding(MoneyUtil.money(terms.initialOutstanding()));
            loan.setPrincipalOutstanding(MoneyUtil.money(terms.principalOutstanding()));
            loan.setDuration(terms.duration());
            loan.setStartDate(request.startDate());
            loan.setInterestUpfront(Boolean.TRUE.equals(request.interestUpfront()));
            loan.setCancelledInterestAmount(MoneyUtil.ZERO);

            // No collection exists, therefore rebuilding the unpaid schedule is safe.
            collectionRepository.deleteByLoan(loan);
            collectionRepository.flush();
            createSchedule(loan);

            List<CollectionEntry> schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);
            LocalDate nextDue = schedule.stream()
                .filter(entry -> entry.getStatus() != CollectionStatus.CANCELLED && entry.getStatus() != CollectionStatus.PAID)
                .map(CollectionEntry::getDueDate)
                .min(LocalDate::compareTo)
                .orElse(null);
            loan.setNextDueDate(nextDue);
            loan.setStatus(nextDue != null && nextDue.isBefore(LocalDate.now()) ? LoanStatus.OVERDUE : LoanStatus.ACTIVE);

            // Keep the original NEW_LOAN cash-flow transaction consistent with the edited terms.
            Payment disbursement = paymentRepository.findByReferenceIdAndCompanyDbId(loan.getLoanId(), tenant.companyId())
                .filter(payment -> payment.getType() == PaymentType.NEW_LOAN)
                .orElse(null);

            if (disbursement == null) {
                disbursement = paymentRepository.findByLoanOrderByPaymentDateDesc(loan).stream()
                    .filter(payment -> payment.getType() == PaymentType.NEW_LOAN)
                    .findFirst()
                    .orElse(null);
            }

            if (disbursement != null) {
                disbursement.setCycle(requestedCycle);
                disbursement.setLoanType(requestedType);
                disbursement.setAmount(MoneyUtil.money(terms.disbursedAmount()));
                disbursement.setPaymentDate(request.startDate());
                disbursement.setNote(requestedCycle.label() + " " + requestedType.name() + " loan disbursement");
                paymentRepository.save(disbursement);
            }
        }

        loan = loanRepository.save(loan);
        syncDocumentChargePayment(loan);
        return toResponse(loan);
    }

    /**
     * Keeps the one-time Document Charges income transaction synchronized with
     * the loan configuration. The charge is separate income: it does not affect
     * principal, repayment, collection schedule or outstanding.
     */
    private void syncDocumentChargePayment(Loan loan) {
        List<Payment> chargePayments = paymentRepository.findByLoanOrderByPaymentDateDesc(loan).stream()
            .filter(payment -> payment.getType() == PaymentType.DOCUMENT_CHARGE)
            .toList();

        boolean enabled = Boolean.TRUE.equals(loan.getDocumentChargeEnabled());
        BigDecimal amount = enabled
            ? MoneyUtil.money(MoneyUtil.nonNegative(loan.getDocumentChargeAmount()))
            : MoneyUtil.ZERO;

        if (!enabled || amount.compareTo(BigDecimal.ZERO) <= 0) {
            chargePayments.forEach(paymentRepository::delete);
            return;
        }

        Payment charge = chargePayments.stream().findFirst().orElseGet(Payment::new);
        charge.setCompanyDbId(loan.getCompanyDbId());
        charge.setType(PaymentType.DOCUMENT_CHARGE);
        charge.setDirection(Direction.IN);
        charge.setCustomer(loan.getCustomer());
        charge.setLoan(loan);
        charge.setCycle(loan.getCycle());
        charge.setLoanType(loan.getLoanType());
        charge.setAmount(amount);
        charge.setCollectionAmount(MoneyUtil.ZERO);
        charge.setInterestPaid(MoneyUtil.ZERO);
        charge.setPrincipalPaid(MoneyUtil.ZERO);
        charge.setFineAmount(MoneyUtil.ZERO);
        charge.setPaymentDate(loan.getStartDate());
        charge.setReferenceId(loan.getLoanId() + "-DOC");
        charge.setPaymentMode("Cash");
        charge.setNote("Document Charges");
        charge = paymentRepository.save(charge);

        if (charge.getPaymentId() == null || charge.getPaymentId().isBlank()) {
            charge.setPaymentId("PAY-" + String.format("%06d", charge.getDbId()));
            paymentRepository.save(charge);
        }

        // Defensive cleanup in case an older build accidentally created duplicates.
        for (int i = 1; i < chargePayments.size(); i++) {
            paymentRepository.delete(chargePayments.get(i));
        }
    }

    private void createSchedule(Loan loan) {
        // The configured duration is always the number of actual scheduled collections.
        // Upfront IO interest affects disbursement only; it does not reduce this count.
        int count = loan.getDuration();
        LocalDate due = DateUtil.firstDueDate(loan.getStartDate(), loan.getCycle());
        for (int i = 0; i < count; i++) {
            CollectionEntry entry = new CollectionEntry();
            entry.setCompanyDbId(loan.getCompanyDbId());
            entry.setLoan(loan);
            entry.setCustomer(loan.getCustomer());
            entry.setCycle(loan.getCycle());
            entry.setDueDate(due);
            entry.setDueAmount(loan.getCollectionAmount());
            entry.setPaidAmount(MoneyUtil.ZERO);
            entry.setFine(MoneyUtil.ZERO);
            entry.setStatus(statusFor(due, MoneyUtil.ZERO, loan.getCollectionAmount()));
            entry = collectionRepository.save(entry);
            entry.setCollectionId("COL-" + String.format("%06d", entry.getDbId()));
            collectionRepository.save(entry);
            due = DateUtil.nextDueDate(due, loan.getCycle());
        }
    }

    @Transactional
    public IoSettlementPreviewResponse ioSettlementPreview(String loanId, LocalDate paymentDate) {
        Loan loan = requireLoan(loanId);
        if (loan.getLoanType() != LoanType.IO) throw new BadRequestException("Settlement preview is available only for Interest Only loans");
        if (loan.getStatus() == LoanStatus.CLOSED || loan.getPrincipalOutstanding().compareTo(BigDecimal.ZERO) <= 0)
            throw new BadRequestException("This IO loan is already closed");

        LocalDate effectiveDate = paymentDate == null ? LocalDate.now() : paymentDate;
        if (effectiveDate.isAfter(LocalDate.now())) throw new BadRequestException("Settlement date cannot be in the future");
        if (effectiveDate.isBefore(loan.getStartDate())) throw new BadRequestException("Settlement date cannot be before the loan disbursed date");

        BigDecimal pendingInterest = MoneyUtil.ZERO;
        BigDecimal futureInterest = MoneyUtil.ZERO;
        int pendingCycles = 0;
        int futureCycles = 0;

        for (CollectionEntry entry : collectionRepository.findByLoanOrderByDueDateAsc(loan)) {
            if (entry.getStatus() == CollectionStatus.CANCELLED) continue;
            BigDecimal balance = MoneyUtil.nonNegative(entry.getDueAmount().subtract(entry.getPaidAmount()));
            if (balance.compareTo(BigDecimal.ZERO) <= 0) continue;

            if (!entry.getDueDate().isAfter(effectiveDate)) {
                pendingInterest = MoneyUtil.money(pendingInterest.add(balance));
                pendingCycles++;
            } else {
                futureInterest = MoneyUtil.money(futureInterest.add(balance));
                futureCycles++;
            }
        }

        BigDecimal principal = MoneyUtil.money(loan.getPrincipalOutstanding());
        return new IoSettlementPreviewResponse(
            loan.getLoanId(),
            effectiveDate,
            principal,
            pendingInterest,
            pendingCycles,
            MoneyUtil.money(principal.add(pendingInterest)),
            futureInterest,
            futureCycles
        );
    }

    @Transactional
    public void repriceIoAfterPrincipalReduction(Loan loan, LocalDate effectiveDate) {
        if (loan == null || loan.getLoanType() != LoanType.IO) return;
        if (loan.getStatus() == LoanStatus.CLOSED || loan.getPrincipalOutstanding().compareTo(BigDecimal.ZERO) <= 0) return;

        BigDecimal newInterestPerCycle = MoneyUtil.money(
            loan.getPrincipalOutstanding()
                .multiply(loan.getInterestRate())
                .divide(BigDecimal.valueOf(100))
        );

        // The new interest rate applies only to FUTURE cycles.
        // Interest already due/pending on or before the principal-payment date
        // remains at the previous amount.
        for (CollectionEntry entry : collectionRepository.findByLoanOrderByDueDateAsc(loan)) {
            if (entry.getStatus() == CollectionStatus.CANCELLED || entry.getStatus() == CollectionStatus.PAID) continue;
            if (!entry.getDueDate().isAfter(effectiveDate)) continue;

            BigDecimal paid = MoneyUtil.money(entry.getPaidAmount());
            BigDecimal revisedDue = newInterestPerCycle.max(paid);
            entry.setDueAmount(MoneyUtil.money(revisedDue));
            entry.setStatus(statusFor(entry.getDueDate(), entry.getPaidAmount(), entry.getDueAmount()));
            collectionRepository.save(entry);
        }

        loan.setInterestAmount(newInterestPerCycle);
        loan.setCollectionAmount(newInterestPerCycle);

        LocalDate nextDue = collectionRepository.findByLoanOrderByDueDateAsc(loan).stream()
            .filter(entry -> entry.getStatus() != CollectionStatus.PAID && entry.getStatus() != CollectionStatus.CANCELLED)
            .map(CollectionEntry::getDueDate)
            .min(LocalDate::compareTo)
            .orElse(null);
        loan.setNextDueDate(nextDue);
        loanRepository.save(loan);
    }

    @Transactional
    public LoanResponse extendIoLoan(String loanId, IoLoanExtensionRequest request) {
        Loan loan = requireLoan(loanId);
        if (loan.getLoanType() != LoanType.IO) throw new BadRequestException("Only Interest Only loans can be extended");
        if (loan.getStatus() == LoanStatus.CLOSED || loan.getPrincipalOutstanding().compareTo(BigDecimal.ZERO) <= 0)
            throw new BadRequestException("A closed IO loan cannot be extended");

        int additionalCycles = request.additionalCycles() == null ? 0 : request.additionalCycles();
        if (additionalCycles <= 0) throw new BadRequestException("Extension cycles must be greater than zero");

        List<CollectionEntry> schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);
        LocalDate due = schedule.stream()
            .map(CollectionEntry::getDueDate)
            .max(LocalDate::compareTo)
            .map(date -> DateUtil.nextDueDate(date, loan.getCycle()))
            .orElseGet(() -> DateUtil.firstDueDate(loan.getStartDate(), loan.getCycle()));

        for (int i = 0; i < additionalCycles; i++) {
            CollectionEntry entry = new CollectionEntry();
            entry.setCompanyDbId(loan.getCompanyDbId());
            entry.setLoan(loan);
            entry.setCustomer(loan.getCustomer());
            entry.setCycle(loan.getCycle());
            entry.setDueDate(due);
            entry.setDueAmount(MoneyUtil.money(loan.getCollectionAmount()));
            entry.setPaidAmount(MoneyUtil.ZERO);
            entry.setFine(MoneyUtil.ZERO);
            entry.setStatus(statusFor(due, MoneyUtil.ZERO, loan.getCollectionAmount()));
            entry = collectionRepository.save(entry);
            entry.setCollectionId("COL-" + String.format("%06d", entry.getDbId()));
            collectionRepository.save(entry);
            due = DateUtil.nextDueDate(due, loan.getCycle());
        }

        int previousExtension = loan.getExtensionCycles() == null ? 0 : loan.getExtensionCycles();
        loan.setExtensionCycles(previousExtension + additionalCycles);
        loan.setDuration((loan.getDuration() == null ? 0 : loan.getDuration()) + additionalCycles);

        BigDecimal additionalInterest = MoneyUtil.money(
            loan.getCollectionAmount().multiply(BigDecimal.valueOf(additionalCycles))
        );
        loan.setTotalInterest(MoneyUtil.money(loan.getTotalInterest().add(additionalInterest)));
        loan.setTotalRepayment(MoneyUtil.money(loan.getTotalRepayment().add(additionalInterest)));
        loan.setLastExtensionReason(request.reason().trim());
        loan.setLastExtendedAt(LocalDateTime.now());

        LocalDate nextDue = collectionRepository.findByLoanOrderByDueDateAsc(loan).stream()
            .filter(e -> e.getStatus() != CollectionStatus.CANCELLED && e.getStatus() != CollectionStatus.PAID)
            .map(CollectionEntry::getDueDate)
            .min(LocalDate::compareTo)
            .orElse(null);
        loan.setNextDueDate(nextDue);

        return toResponse(loanRepository.save(loan));
    }

    public CollectionStatus statusFor(LocalDate date, BigDecimal paid, BigDecimal due) {
        if (paid != null && due != null && paid.compareTo(due) >= 0) return CollectionStatus.PAID;
        if (paid != null && paid.compareTo(BigDecimal.ZERO) > 0) return CollectionStatus.PENDING;
        LocalDate today = LocalDate.now();
        if (date.isBefore(today)) return CollectionStatus.OVERDUE;
        if (date.equals(today)) return CollectionStatus.DUE_TODAY;
        return CollectionStatus.UNPAID;
    }

    public Loan requireLoan(String loanId) {
        Loan loan = loanRepository.findByLoanIdAndCompanyDbId(loanId, tenant.companyId())
            .orElseThrow(() -> new NotFoundException("Loan not found: " + loanId));
        return ensureCurrentIoPolicy(loan);
    }

    /**
     * Repairs ACTIVE IO loans created before Phase 9.0.27.
     *
     * Old behaviour treated upfront interest as installment #1 and generated
     * duration - 1 schedule rows. The current rule keeps the full configured
     * duration regardless of upfront interest.
     *
     * Closed loans are intentionally left unchanged so historical settlements
     * are never rewritten.
     */
    private Loan ensureCurrentIoPolicy(Loan loan) {
        if (loan == null || loan.getLoanType() != LoanType.IO || loan.getStatus() == LoanStatus.CLOSED) {
            return loan;
        }

        int expectedCycles = Math.max(1, loan.getDuration() == null ? 1 : loan.getDuration());
        List<CollectionEntry> schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);

        long liveCycleCount = schedule.stream()
            .filter(entry -> entry.getStatus() != CollectionStatus.CANCELLED)
            .count();

        if (liveCycleCount < expectedCycles) {
            int missingCycles = (int) (expectedCycles - liveCycleCount);

            LocalDate due = schedule.stream()
                .filter(entry -> entry.getStatus() != CollectionStatus.CANCELLED)
                .map(CollectionEntry::getDueDate)
                .max(LocalDate::compareTo)
                .map(date -> DateUtil.nextDueDate(date, loan.getCycle()))
                .orElseGet(() -> DateUtil.firstDueDate(loan.getStartDate(), loan.getCycle()));

            for (int i = 0; i < missingCycles; i++) {
                CollectionEntry entry = new CollectionEntry();
                entry.setCompanyDbId(loan.getCompanyDbId());
                entry.setLoan(loan);
                entry.setCustomer(loan.getCustomer());
                entry.setCycle(loan.getCycle());
                entry.setDueDate(due);
                entry.setDueAmount(MoneyUtil.money(loan.getCollectionAmount()));
                entry.setPaidAmount(MoneyUtil.ZERO);
                entry.setFine(MoneyUtil.ZERO);
                entry.setStatus(statusFor(due, MoneyUtil.ZERO, loan.getCollectionAmount()));
                entry = collectionRepository.save(entry);
                entry.setCollectionId("COL-" + String.format("%06d", entry.getDbId()));
                collectionRepository.save(entry);
                due = DateUtil.nextDueDate(due, loan.getCycle());
            }

            schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);
        }

        // Self-heal ACTIVE IO loans after a partial principal payment.
        // This makes the rule reliable even if a previous frontend/backend refresh
        // returned stale collection rows or a payment was recorded by an older build.
        boolean principalReduced = loan.getPrincipalOutstanding() != null
            && loan.getPrincipal() != null
            && loan.getPrincipalOutstanding().compareTo(loan.getPrincipal()) < 0
            && loan.getPrincipalOutstanding().compareTo(BigDecimal.ZERO) > 0;

        if (principalReduced) {
            LocalDate latestPrincipalPaymentDate = paymentRepository.findByLoanOrderByPaymentDateDesc(loan).stream()
                .filter(payment -> payment.getPrincipalPaid() != null
                    && payment.getPrincipalPaid().compareTo(BigDecimal.ZERO) > 0)
                .map(Payment::getPaymentDate)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());

            BigDecimal correctInterestPerCycle = MoneyUtil.money(
                loan.getPrincipalOutstanding()
                    .multiply(loan.getInterestRate())
                    .divide(BigDecimal.valueOf(100))
            );

            boolean pricingNeedsRepair = loan.getCollectionAmount() == null
                || loan.getCollectionAmount().compareTo(correctInterestPerCycle) != 0
                || loan.getInterestAmount() == null
                || loan.getInterestAmount().compareTo(correctInterestPerCycle) != 0
                || schedule.stream().anyMatch(entry ->
                    entry.getStatus() != CollectionStatus.CANCELLED
                    && entry.getStatus() != CollectionStatus.PAID
                    && entry.getDueDate().isAfter(latestPrincipalPaymentDate)
                    && entry.getDueAmount().compareTo(correctInterestPerCycle.max(entry.getPaidAmount())) != 0
                );

            if (pricingNeedsRepair) {
                repriceIoAfterPrincipalReduction(loan, latestPrincipalPaymentDate);
                schedule = collectionRepository.findByLoanOrderByDueDateAsc(loan);
            }
        }

        boolean changed = false;

        // Phase 9.0.27 legacy projection repair is only valid before principal
        // has been reduced. After a partial principal repayment, collectionAmount
        // is intentionally repriced to the new outstanding principal and must not
        // be treated as the original contract interest amount.
        boolean principalUntouched = loan.getPrincipalOutstanding() != null
            && loan.getPrincipalOutstanding().compareTo(loan.getPrincipal()) == 0;

        if (principalUntouched) {
            BigDecimal scheduledInterest = MoneyUtil.money(
                loan.getCollectionAmount().multiply(BigDecimal.valueOf(expectedCycles))
            );
            BigDecimal upfrontInterest = loan.isInterestUpfront()
                ? MoneyUtil.money(loan.getInterestAmount())
                : MoneyUtil.ZERO;

            BigDecimal correctedTotalInterest = MoneyUtil.money(scheduledInterest.add(upfrontInterest));
            BigDecimal correctedProjectedRepayment = MoneyUtil.money(loan.getPrincipal().add(scheduledInterest));

            changed = loan.getTotalInterest() == null
                || loan.getTotalInterest().compareTo(correctedTotalInterest) != 0
                || loan.getTotalRepayment() == null
                || loan.getTotalRepayment().compareTo(correctedProjectedRepayment) != 0;

            if (changed) {
                loan.setTotalInterest(correctedTotalInterest);
                loan.setTotalRepayment(correctedProjectedRepayment);
            }
        }

        LocalDate nextDue = schedule.stream()
            .filter(entry -> entry.getStatus() != CollectionStatus.CANCELLED && entry.getStatus() != CollectionStatus.PAID)
            .map(CollectionEntry::getDueDate)
            .min(LocalDate::compareTo)
            .orElse(null);

        if ((loan.getNextDueDate() == null && nextDue != null)
            || (loan.getNextDueDate() != null && !loan.getNextDueDate().equals(nextDue))) {
            loan.setNextDueDate(nextDue);
            changed = true;
        }

        return changed ? loanRepository.save(loan) : loan;
    }

    private String nextLoanId(Long companyId) {
        String prefix = effectiveLoanPrefix(companyId);
        Set<Integer> used = new HashSet<>();

        for (Loan existing : loanRepository.findByCompanyDbIdOrderByDbIdAsc(companyId)) {
            String id = String.valueOf(existing.getLoanId() == null ? "" : existing.getLoanId()).trim().toUpperCase();
            String idPrefix = prefix.toUpperCase() + "LN-";

            if (!id.startsWith(idPrefix)) continue;

            try {
                used.add(Integer.parseInt(id.substring(idPrefix.length())));
            } catch (NumberFormatException ignored) {
            }
        }

        int sequence = 1;
        while (used.contains(sequence)) sequence++;

        return prefix + "LN-" + String.format("%05d", sequence);
    }

    private String effectiveLoanPrefix(Long companyId) {
        String base = companyPrefix();
        boolean usedByAnotherCompany =
            loanRepository.existsByLoanIdStartingWithAndCompanyDbIdNot(base + "LN-", companyId);
        return usedByAnotherCompany ? base + companyId : base;
    }

    private String companyPrefix() {
        String name = tenant.company().getName();
        StringBuilder out = new StringBuilder();
        for (String part : String.valueOf(name).trim().split("\\s+")) {
            if (!part.isBlank()) out.append(Character.toUpperCase(part.charAt(0)));
            if (out.length() >= 4) break;
        }
        return out.length() >= 2 ? out.toString() : "CRD";
    }

    public LoanResponse toResponse(Loan loan) {
        return new LoanResponse(
            loan.getLoanId(), loan.getCustomer().getCustomerId(), loan.getCustomer().getName(), loan.getCycle().label(),
            loan.getLoanType().name(), MoneyUtil.money(loan.getPrincipal()), MoneyUtil.money(loan.getDisbursedAmount()),
            loan.getInterestRate(), MoneyUtil.money(loan.getInterestAmount()), MoneyUtil.money(loan.getTotalInterest()),
            MoneyUtil.money(loan.getTotalRepayment()), MoneyUtil.money(loan.getCollectionAmount()), MoneyUtil.money(loan.getOutstanding()),
            MoneyUtil.money(loan.getPrincipalOutstanding()), loan.getDuration(), loan.getStartDate(), loan.getNextDueDate(),
            StatusUtil.label(loan.getStatus()), loan.isInterestUpfront(), Boolean.TRUE.equals(loan.getFineEnabled()),
            MoneyUtil.money(loan.getFineAmount()), Boolean.TRUE.equals(loan.getDocumentChargeEnabled()),
            MoneyUtil.money(loan.getDocumentChargeAmount()), loan.getExtensionCycles() == null ? 0 : loan.getExtensionCycles(),
            loan.getLastExtensionReason(), loan.getLastExtendedAt(), MoneyUtil.money(loan.getCancelledInterestAmount()),
            loan.getClosedDate()
        );
    }
}
