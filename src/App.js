import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState } from "react";
import AttendanceSystem from "./pages/AttendanceSystem";
import ImageCaptcha from "./pages/ImageCaptcha";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [isVerified, setIsVerified] = useState(false);

  const handleVerification = (verified) => {
    setIsVerified(verified);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<ImageCaptcha onVerified={handleVerification} />}
        />
        <Route
          path="/attendance"
          element={isVerified ? <AttendanceSystem /> : <Navigate to="/" />}
        />
      </Routes>
    </Router>
  );
}

export default App;
