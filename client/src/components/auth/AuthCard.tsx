import React, { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ title, description, children }) => {
  return (
    <div className="w-full max-w-md p-8 bg-neutral-900/80 border border-neutral-800 rounded-2xl shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-400">{description}</p>}
      </div>
      {children}
    </div>
  );
};

