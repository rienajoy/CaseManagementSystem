import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>Unauthorized</h2>
      <p>You do not have permission to access this page.</p>
      <button onClick={() => navigate("/dashboard")} style={{ padding: 10 }}>
        Go back
      </button>
    </div>
  );
}