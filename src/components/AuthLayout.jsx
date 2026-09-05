import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="page-glow flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900">
            <Icon className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="glass rounded-[24px] p-8">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}