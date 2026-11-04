"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { identidade } from "@/config/identidade";
import { menu } from "@/config/menu";

export function Cabecalho() {
  const caminho = usePathname();
  return (
    <header className="sticky top-0 z-10 bg-white shadow">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        {identidade.logo ? (
          <Image
            src={identidade.logo}
            alt={identidade.nome}
            width={47}
            height={56}
            priority
            className="h-14 w-auto object-contain"
          />
        ) : null}
        <span className="text-lg font-bold" style={{ color: "var(--cor-principal)" }}>
          {identidade.nome}
        </span>
      </div>
      <nav className="text-white" style={{ background: "var(--cor-principal)" }}>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 py-2">
          {menu.map((item) => {
            const ativo = caminho === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                  ativo ? "bg-white/25" : "hover:bg-white/10"
                }`}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
