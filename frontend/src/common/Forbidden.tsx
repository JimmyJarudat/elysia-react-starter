import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";

const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center bg-app p-6">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-2xl bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400">
          <ShieldX size={48} />
        </div>

        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-red-500 dark:text-red-400">
          403 Forbidden
        </p>
        <h1 className="text-3xl font-semibold tracking-normal text-light-text dark:text-dark-text">
          ไม่มีสิทธิ์เข้าถึง
        </h1>
        <p className="mt-3 text-sm text-light-text-muted dark:text-dark-text-muted">
          คุณไม่ได้รับอนุญาตให้เข้าถึงหน้านี้
          <br />
          กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเกิดข้อผิดพลาด
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-theme px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-primary/10 hover:text-light-primary dark:text-dark-text dark:hover:bg-dark-primary/10 dark:hover:text-dark-primary"
          >
            ย้อนกลับ
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-md bg-light-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-light-primary-hover dark:bg-dark-primary dark:text-dark-background dark:hover:bg-dark-primary-hover"
          >
            ไปหน้าหลัก
          </button>
        </div>
      </section>
    </main>
  );
};

export default Forbidden;
