"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  rotuloDia,
  somarDias,
} from "@/lib/datas";

type CelulaAberta = { data: string; turno: Turno };

/** Chave de uma célula da grade: "2026-11-20|id-do-turno". */
function chave(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<CelulaAberta | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const dias = diasDaSemana(segunda);
  const hoje = hojeISO();

  // Turnos e funcionários: carregados uma vez.
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) {
        setErro("As variáveis do Supabase não estão configuradas. Veja a tela Início.");
        setCarregando(false);
        return;
      }
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro("Não foi possível carregar os dados. Detalhe: " + (t.error ?? f.error)!.message);
        return;
      }
      setTurnos(t.data as Turno[]);
      setFuncionarios(f.data as Funcionario[]);
    }
    carregarBase();
  }, []);

  // Escalas da semana que está na tela.
  const carregarEscalas = useCallback(async () => {
    if (!variaveisConfiguradas()) return;
    setCarregando(true);
    const { data, error } = await supabase()
      .from("escalas")
      .select("id, data, turno_id, funcionario_id")
      .gte("data", segunda)
      .lte("data", somarDias(segunda, 6));
    if (error) setErro("Não foi possível carregar a escala. Detalhe: " + error.message);
    else setEscalas(data as Escala[]);
    setCarregando(false);
  }, [segunda]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarEscalas();
  }, [carregarEscalas]);

  // Agrupa as escalas por célula.
  const porCelula = new Map<string, Escala[]>();
  for (const e of escalas) {
    const k = chave(e.data, e.turno_id);
    porCelula.set(k, [...(porCelula.get(k) ?? []), e]);
  }
  const porId = new Map(funcionarios.map((f) => [f.id, f]));

  function nomesDaCelula(data: string, turnoId: string): Funcionario[] {
    return (porCelula.get(chave(data, turnoId)) ?? [])
      .map((e) => porId.get(e.funcionario_id))
      .filter((f): f is Funcionario => Boolean(f))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async function alternar(funcionario: Funcionario) {
    if (!aberta) return;
    const { data, turno } = aberta;
    const existente = (porCelula.get(chave(data, turno.id)) ?? []).find(
      (e) => e.funcionario_id === funcionario.id,
    );
    setSalvandoId(funcionario.id);
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro("Não foi possível remover. Detalhe: " + error.message);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro("Não foi possível salvar. Detalhe: " + error.message);
      else setEscalas((atual) => [...atual, nova as Escala]);
    }
    setSalvandoId(null);
  }

  // Na lista da célula: todos os ativos, mais desativados que já estejam escalados ali.
  const opcoes = aberta
    ? funcionarios.filter(
        (f) =>
          f.ativo ||
          (porCelula.get(chave(aberta.data, aberta.turno.id)) ?? []).some(
            (e) => e.funcionario_id === f.id,
          ),
      )
    : [];
  const escaladosNaAberta = new Set(
    aberta ? (porCelula.get(chave(aberta.data, aberta.turno.id)) ?? []).map((e) => e.funcionario_id) : [],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="cartao space-y-3">
        <p className="text-center text-lg font-semibold">
          {diaMes(dias[0])} a {diaMes(dias[6])}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, -7))}>
            ← Anterior
          </button>
          <button className="botao-secundario" onClick={() => setSegunda(somarDias(segunda, 7))}>
            Próxima →
          </button>
        </div>
        {segunda !== inicioDaSemana(hoje) && (
          <button className="botao w-full" onClick={() => setSegunda(inicioDaSemana(hoje))}>
            Voltar para esta semana
          </button>
        )}
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      <p className="text-sm text-neutral-600">
        Toque em um quadro para escolher quem trabalha. Arraste a grade para o lado para ver todos os dias.
      </p>

      <div className={`overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm ${carregando ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] border-b border-r border-neutral-200 bg-white p-2 text-sm">
                Turno
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className="min-w-[7.5rem] border-b border-neutral-200 p-2 text-center text-sm"
                  style={d === hoje ? { color: "var(--cor-destaque)" } : undefined}
                >
                  {rotuloDia(d)}
                  {d === hoje && <span className="block text-xs">Hoje</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <th className="sticky left-0 z-[1] border-r border-b border-neutral-200 bg-white p-2 align-top">
                  <span className="block font-semibold">{t.nome}</span>
                  <span className="block text-xs font-normal text-neutral-500">
                    {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                  </span>
                </th>
                {dias.map((d) => {
                  const pessoas = nomesDaCelula(d, t.id);
                  return (
                    <td key={d} className="border-b border-neutral-200 p-1 align-top">
                      <button
                        className={`flex min-h-[5.5rem] w-full flex-col items-start gap-1 rounded-xl p-2 text-left text-sm active:bg-neutral-100 ${
                          d === hoje ? "border-2" : "border border-dashed border-neutral-300"
                        }`}
                        style={d === hoje ? { borderColor: "var(--cor-destaque)" } : undefined}
                        onClick={() => setAberta({ data: d, turno: t })}
                      >
                        {pessoas.length === 0 ? (
                          <span className="text-neutral-400">+ Escolher</span>
                        ) : (
                          <>
                            {pessoas.map((p) => (
                              <span key={p.id} className="leading-tight">
                                {p.nome.split(" ")[0]}
                              </span>
                            ))}
                            <span className="mt-auto text-xs text-neutral-500">
                              {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
                            </span>
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aberta && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setAberta(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              {aberta.turno.nome} · {DIAS_SEMANA[paraData(aberta.data).getDay()]} {diaMes(aberta.data)}
            </h2>
            <p className="mb-3 text-sm text-neutral-600">
              Toque para marcar ou desmarcar. Salva na hora.
            </p>
            <ul className="space-y-2">
              {opcoes.map((f) => {
                const marcado = escaladosNaAberta.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                        marcado ? "border-transparent text-white" : "border-neutral-300 bg-white"
                      }`}
                      style={marcado ? { background: "var(--cor-principal)" } : undefined}
                      onClick={() => alternar(f)}
                      disabled={salvandoId !== null}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 text-lg font-bold ${
                          marcado ? "border-white" : "border-neutral-400"
                        }`}
                      >
                        {marcado ? "✓" : ""}
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold">{f.nome}</span>
                        <span className={`block text-sm ${marcado ? "text-white/80" : "text-neutral-600"}`}>
                          {f.funcao}
                          {!f.ativo && " · desativado"}
                        </span>
                      </span>
                      {salvandoId === f.id && <span className="text-sm">Salvando...</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <button className="botao mt-4 w-full" onClick={() => setAberta(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
