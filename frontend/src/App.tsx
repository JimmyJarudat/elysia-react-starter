import { Link } from "react-router-dom";

const App = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-app p-6">
      <section className="w-full max-w-xl rounded-lg border border-theme bg-light-background-card p-8 shadow-soft dark:bg-dark-background-card">
        <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Elysia React Starter</p>
        <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">Layout shell is ready.</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">โครงหลักถูกจัดให้รันด้วย mock menu ก่อน แล้วค่อยต่อ API จริงภายหลังได้</p>
        <Link className="mt-6 inline-flex items-center justify-center rounded-md bg-ocean-100 px-3 py-2 text-sm font-bold text-ocean-700 dark:bg-slate-blue-800 dark:text-dark-primary" to="/dashboard">
          Open dashboard
        </Link>
      </section>
    </main>
  );
};

export default App;
