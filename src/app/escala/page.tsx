"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Regra, Turno } from "@/lib/tipos";
import { RESTAURANTE } from "@/config/restaurante";
import { cobreTurno, textoHorario } from "@/lib/jornada";
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
type Contagem = { funcao: string; escalados: number; minimo: number };

/** Chave de uma célula da grade: "2026-11-20|id-do-turno". */
function chave(data: string, turnoId: string) {
  return `${data}|${turnoId}`;
}

function abre(data: string) {
  return RESTAURANTE.diasFuncionamento.includes(paraData(data).getDay());
}

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<CelulaAberta | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const dias = diasDaSemana(segunda);
  const diasAbertos = dias.filter(abre);
  const diasFolga = dias.filter((d) => !abre(d));
  const hoje = hojeISO();

  // Turnos, funcionários e regras: carregados uma vez.
  useEffect(() => {
    async function carregarBase() {
      if (!variaveisConfiguradas()) {
        setErro("As variáveis do Supabase não estão configuradas. Veja a tela Início.");
        setCarregando(false);
        return;
      }
      const db = supabase();
      const [t, f, r] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("*").order("nome"),
        db.from("regras").select("id, dia_semana, turno_id, funcao, minimo"),
      ]);
      const falha = t.error ?? f.error ?? r.error;
      if (falha) {
        setErro("Não foi possível carregar os dados. Detalhe: " + falha.message);
        return;
      }
      setTurnos(t.data as Turno[]);
      setFuncionarios(f.data as Funcionario[]);
      setRegras(r.data as Regra[]);
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

  const porId = new Map(funcionarios.map((f) => [f.id, f]));
  const porCelula = new Map<string, Escala[]>();
  for (const e of escalas) {
    const k = chave(e.data, e.turno_id);
    porCelula.set(k, [...(porCelula.get(k) ?? []), e]);
  }

  /** Mínimo de uma função no turno e dia (a regra do dia vale mais que a geral). */
  function minimo(turnoId: string, funcao: string, data: string): number {
    const dia = paraData(data).getDay();
    const doTurno = regras.filter((r) => r.turno_id === turnoId && r.funcao === funcao);
    const doDia = doTurno.find((r) => r.dia_semana === dia);
    return (doDia ?? doTurno.find((r) => r.dia_semana === null))?.minimo ?? 0;
  }

  function contagens(data: string, turnoId: string): Contagem[] {
    const escalados = (porCelula.get(chave(data, turnoId)) ?? [])
      .map((e) => porId.get(e.funcionario_id))
      .filter((f): f is Funcionario => Boolean(f));
    const funcoes = Array.from(
      new Set([
        ...RESTAURANTE.funcoes,
        ...regras.filter((r) => r.turno_id === turnoId).map((r) => r.funcao),
        ...escalados.map((f) => f.funcao),
      ]),
    );
    return funcoes
      .map((funcao) => ({
        funcao,
        escalados: escalados.filter((f) => f.funcao === funcao).length,
        minimo: minimo(turnoId, funcao, data),
      }))
      .filter((c) => c.minimo > 0 || c.escalados > 0);
  }

  const celulasAbaixo = diasAbertos.flatMap((d) =>
    turnos.filter((t) => contagens(d, t.id).some((c) => c.escalados < c.minimo)).map((t) => `${t.nome} de ${rotuloDia(d)}`),
  );

  async function montarSemana() {
    const textoSemana = `${diaMes(dias[0])} a ${diaMes(dias[6])}`;
    const pergunta =
      escalas.length > 0
        ? `Substituir a escala de ${textoSemana} pela escala automática? Os ajustes feitos à mão nesta semana serão desfeitos.`
        : `Montar a escala de ${textoSemana} pelo horário de cada funcionário?`;
    if (!confirm(pergunta)) return;
    setMontando(true);
    setErro(null);
    const db = supabase();
    const apagar = await db.from("escalas").delete().gte("data", segunda).lte("data", somarDias(segunda, 6));
    if (apagar.error) {
      setErro("Não foi possível limpar a semana. Detalhe: " + apagar.error.message);
      setMontando(false);
      return;
    }
    const ativos = funcionarios.filter((f) => f.ativo);
    const novas = diasAbertos.flatMap((data) =>
      turnos.flatMap((t) =>
        ativos.filter((f) => cobreTurno(f, t)).map((f) => ({ data, turno_id: t.id, funcionario_id: f.id })),
      ),
    );
    if (novas.length > 0) {
      const { error } = await db.from("escalas").insert(novas);
      if (error) setErro("Não foi possível salvar a escala. Detalhe: " + error.message);
    }
    await carregarEscalas();
    setMontando(false);
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

  // Lista da célula aberta, agrupada por função.
  const escaladosNaAberta = new Set(
    aberta ? (porCelula.get(chave(aberta.data, aberta.turno.id)) ?? []).map((e) => e.funcionario_id) : [],
  );
  const contagensAberta = aberta ? contagens(aberta.data, aberta.turno.id) : [];
  const gruposAberta = contagensAberta.map((c) => ({
    ...c,
    pessoas: funcionarios
      .filter((f) => f.funcao === c.funcao && (f.ativo || escaladosNaAberta.has(f.id)))
      .sort((a, b) => {
        // Primeiro quem está escalado, depois quem pode, por último quem está fora do horário.
        const pontos = (f: Funcionario) =>
          escaladosNaAberta.has(f.id) ? 0 : cobreTurno(f, aberta!.turno) ? 1 : 2;
        return pontos(a) - pontos(b) || a.nome.localeCompare(b.nome);
      }),
  }));

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
          <button className="botao-secundario w-full" onClick={() => setSegunda(inicioDaSemana(hoje))}>
            Voltar para esta semana
          </button>
        )}
        <button className="botao w-full" onClick={montarSemana} disabled={montando || turnos.length === 0}>
          {montando ? "Montando..." : "Montar escala da semana"}
        </button>
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      {!carregando && turnos.length > 0 && (
        <div
          className={`cartao ${celulasAbaixo.length === 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
        >
          {celulasAbaixo.length === 0 ? (
            <p className="font-semibold text-green-800">✓ Todos os turnos da semana estão completos.</p>
          ) : (
            <>
              <p className="font-semibold text-red-700">
                {celulasAbaixo.length} {celulasAbaixo.length === 1 ? "turno está" : "turnos estão"} abaixo do mínimo
              </p>
              <p className="mt-1 text-sm text-red-700">
                {celulasAbaixo.slice(0, 4).join(", ")}
                {celulasAbaixo.length > 4 && ` e mais ${celulasAbaixo.length - 4}`}
              </p>
            </>
          )}
        </div>
      )}

      <p className="text-sm text-neutral-600">
        Toque em um quadro para ver e ajustar quem trabalha. Arraste a grade para o lado para ver todos os dias.
      </p>

      <div
        className={`overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm ${carregando ? "opacity-60" : ""}`}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] border-b border-r border-neutral-200 bg-white p-2 text-sm">
                Turno
              </th>
              {diasAbertos.map((d) => (
                <th
                  key={d}
                  className="min-w-[8.5rem] border-b border-neutral-200 p-2 text-center text-sm"
                  style={d === hoje ? { color: "var(--cor-destaque)" } : undefined}
                >
                  {rotuloDia(d)}
                  {d === hoje && <span className="block text-xs">Hoje</span>}
                </th>
              ))}
              {diasFolga.map((d) => (
                <th key={d} className="min-w-[4.5rem] border-b border-neutral-200 p-2 text-center text-sm text-neutral-400">
                  {rotuloDia(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t, i) => (
              <tr key={t.id}>
                <th className="sticky left-0 z-[1] border-b border-r border-neutral-200 bg-white p-2 align-top">
                  <span className="block font-semibold leading-tight">{t.nome}</span>
                  <span className="block text-xs font-normal text-neutral-500">
                    {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                  </span>
                </th>
                {diasAbertos.map((d) => {
                  const lista = contagens(d, t.id);
                  const completo = lista.every((c) => c.escalados >= c.minimo);
                  const vazio = lista.every((c) => c.escalados === 0);
                  return (
                    <td key={d} className="border-b border-neutral-200 p-1 align-top">
                      <button
                        className={`flex min-h-[5.5rem] w-full flex-col items-stretch gap-0.5 rounded-xl p-2 text-left text-sm active:bg-neutral-100 ${
                          d === hoje ? "border-2" : "border"
                        } ${vazio ? "border-dashed border-neutral-300" : completo ? "border-green-400 bg-green-50" : "border-red-300 bg-red-50"}`}
                        style={d === hoje ? { borderColor: "var(--cor-destaque)" } : undefined}
                        onClick={() => setAberta({ data: d, turno: t })}
                      >
                        {lista.map((c) => {
                          const ok = c.escalados >= c.minimo;
                          return (
                            <span key={c.funcao} className="flex justify-between gap-2">
                              <span className="text-neutral-700">{c.funcao}</span>
                              <span className={`font-semibold ${ok ? "text-green-800" : "text-red-700"}`}>
                                {c.escalados}/{c.minimo}
                              </span>
                            </span>
                          );
                        })}
                      </button>
                    </td>
                  );
                })}
                {i === 0 &&
                  diasFolga.map((d) => (
                    <td
                      key={d}
                      rowSpan={turnos.length}
                      className="border-b border-neutral-200 bg-neutral-50 p-2 text-center align-middle text-sm font-semibold text-neutral-400"
                    >
                      Folga
                    </td>
                  ))}
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
              Toque para marcar ou desmarcar. Salva na hora. Só dá para escalar quem está no horário do turno
              inteiro, fora das pausas.
            </p>
            {gruposAberta.map((g) => (
              <section key={g.funcao} className="mb-4">
                <h3
                  className={`sticky top-0 z-[1] -mx-1 mb-2 rounded-lg bg-white px-1 py-1 font-semibold ${
                    g.escalados >= g.minimo ? "text-green-800" : "text-red-700"
                  }`}
                >
                  {g.funcao}: {g.escalados} de {g.minimo}
                  {g.escalados >= g.minimo ? " ✓" : ` (faltam ${g.minimo - g.escalados})`}
                </h3>
                <ul className="space-y-2">
                  {g.pessoas.map((f) => {
                    const marcado = escaladosNaAberta.has(f.id);
                    const pode = cobreTurno(f, aberta.turno);
                    return (
                      <li key={f.id}>
                        <button
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-50 ${
                            marcado ? "border-transparent text-white" : "border-neutral-300 bg-white"
                          }`}
                          style={marcado ? { background: "var(--cor-principal)" } : undefined}
                          onClick={() => alternar(f)}
                          disabled={salvandoId !== null || (!marcado && !pode)}
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
                              {textoHorario(f) ?? "Sem horário"}
                              {!pode && " · fora do horário"}
                              {!f.ativo && " · desativado"}
                            </span>
                          </span>
                          {salvandoId === f.id && <span className="text-sm">Salvando...</span>}
                        </button>
                      </li>
                    );
                  })}
                  {g.pessoas.length === 0 && <li className="text-sm text-neutral-500">Ninguém nesta função.</li>}
                </ul>
              </section>
            ))}
            <button className="botao sticky bottom-0 mt-2 w-full" onClick={() => setAberta(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
