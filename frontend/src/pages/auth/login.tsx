import { Link } from "react-router-dom";

const LoginPage = () => {
  return (
    <main className="public-page">
      <section className="public-panel">
        <p className="eyebrow">Demo login</p>
        <h1>Mock session</h1>
        <p>ตอนนี้ยังไม่ต่อ auth จริง สามารถเข้า dashboard เพื่อทดสอบ layout ได้เลย</p>
        <Link className="primary-link" to="/dashboard">
          Continue
        </Link>
      </section>
    </main>
  );
};

export default LoginPage;
