import { useSystemIdentity } from "@/contexts/SystemIdentityContext";

type AuthPageHeaderProps = {
  title: string;
  description: string;
};

const AuthPageHeader = ({ title, description }: AuthPageHeaderProps) => {
  const { identity } = useSystemIdentity();

  return (
    <header className="mb-8 text-center">
      <div className="mx-auto mb-5 flex h-24 w-full max-w-64 items-center justify-center">
        <img
          src="/elysia.svg"
          alt="Elysia"
          className="max-h-20 w-full object-contain dark:brightness-0 dark:invert"
        />
      </div>

      <p className="text-xl font-bold text-light-primary dark:text-dark-primary sm:text-2xl">
        {identity.systemName}
      </p>
      <h1 className="mt-5 text-3xl font-semibold text-slate-900 dark:text-slate-50">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </header>
  );
};

export default AuthPageHeader;
