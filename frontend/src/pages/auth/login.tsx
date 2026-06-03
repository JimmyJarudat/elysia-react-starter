import { Link } from "react-router-dom";

const LoginPage = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-app p-6">
      <section className="w-full max-w-xl rounded-lg border border-theme bg-light-background-card p-8 shadow-soft dark:bg-dark-background-card">
        <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-light-primary dark:text-dark-primary">Demo login</p>
        <h1 className="text-3xl font-semibold tracking-normal text-slate-900 dark:text-slate-50">Mock session</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">ตอนนี้ยังไม่ต่อ auth จริง สามารถเข้า dashboard เพื่อทดสอบ layout ได้เลย</p>
        <Link className="mt-6 inline-flex items-center justify-center rounded-md bg-light-primary/10 px-3 py-2 text-sm font-bold text-light-primary transition-colors hover:bg-light-primary/15 dark:bg-dark-primary/10 dark:text-dark-primary dark:hover:bg-dark-primary/15" to="/dashboard">
          Continue
        </Link>
      </section>
    </main>
  );
};

export default LoginPage;
