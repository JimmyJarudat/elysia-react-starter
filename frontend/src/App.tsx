import { Link } from "react-router-dom";

const App = () => {
  return (
    <main className="public-page">
      <section className="public-panel">
        <p className="eyebrow">Elysia React Starter</p>
        <h1>Layout shell is ready.</h1>
        <p>โครงหลักถูกจัดให้รันด้วย mock menu ก่อน แล้วค่อยต่อ API จริงภายหลังได้</p>
        <Link className="primary-link" to="/dashboard">
          Open dashboard
        </Link>
      </section>
    </main>
  );
};

export default App;
