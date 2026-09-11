import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * App-wide Back button for authenticated CREDNIVO pages.
 * Uses real browser history when possible, with /dashboard as a safe fallback.
 */
export default function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Do not show on auth/landing pages.
  const hiddenPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];

  if (hiddenPaths.some((path) => location.pathname.startsWith(path))) {
    return null;
  }

  const goBack = () => {
    // history.length can include the login page, so keep dashboard safe.
    if (location.pathname === "/" || location.pathname === "/dashboard") {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <button
      type="button"
      className="crednivo-global-back"
      onClick={goBack}
      aria-label="Go back"
      title="Back"
    >
      <ArrowLeft />
    </button>
  );
}
