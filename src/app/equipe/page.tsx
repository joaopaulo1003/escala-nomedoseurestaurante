"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Funcionario, Turno } from "@/lib/tipos";
import { RESTAURANTE } from "@/config/restaurante";
import { formatarHoras, minutosPorSemana, textoHorario, validarHorario } from "@/lib/jornada";

type Formulario = {
  id: string | null;
  nome: string;
  funcao: string;
  telefone: string;
  hora_entrada: string;
  hora_saida: string;
  inicio_almoco: string;
  inicio_cafe: string;
};

const FORMULARIO_VAZIO: Formulario = {
  id: null,
  nome: "",
  funcao: RESTAURANTE.funcoes[0],
  telefone: "",
  hora_entrada: "",
  hora_saida: "",
  inicio_almoco: "",
  inicio_cafe: "",
};

const curta = (h: string | null) => (h ? h.slice(0, 5) : "");

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [errosFormulario, setErrosFormulario] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [filtro, setFiltro] = useState<string>("Todos");

  const carregar = useCallback(async () => {
    if (!variaveisConfiguradas()) {
      setErro("As variáveis do Supabase não estão configuradas. Veja a tela Início.");
      setCarregando(false);
      return;
    }
    const db = supabase();
    const [f, t] = await Promise.all([
      db.from("funcionarios").select("*").order("nome"),
      db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
    ]);
    if (f.error || t.error) {
      setErro("Não foi possível carregar a equipe. Detalhe: " + (f.error ?? t.error)!.message);
    } else {
      setErro(null);
      setFuncionarios(f.data as Funcionario[]);
      setTurnos(t.data as Turno[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const ativos = funcionarios.filter((f) => f.ativo);
  const desativados = funcionarios.filter((f) => !f.ativo);
  const funcoes = Array.from(new Set([...RESTAURANTE.funcoes, ...ativos.map((f) => f.funcao)]));
  const listados = filtro === "Todos" ? ativos : ativos.filter((f) => f.funcao === filtro);

  function abrir(f: Formulario) {
    setFormulario(f);
    setErrosFormulario([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    const horario = {
      hora_entrada: formulario.hora_entrada || null,
      hora_saida: formulario.hora_saida || null,
      inicio_almoco: formulario.inicio_almoco || null,
      inicio_cafe: formulario.inicio_cafe || null,
    };
    const problemas = [...(nome ? [] : ["Preencha o nome do funcionário."]), ...validarHorario(horario, turnos)];
    setErrosFormulario(problemas);
    if (problemas.length > 0) return;

    setSalvando(true);
    const dados = {
      nome,
      funcao: formulario.funcao,
      telefone: formulario.telefone.trim() || null,
      ...horario,
    };
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      setErrosFormulario(["Não foi possível salvar. Detalhe: " + error.message]);
      return;
    }
    setFormulario(null);
    await carregar();
  }

  async function mudarAtivo(funcionario: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${funcionario.nome}? Ele(a) sai da escala, mas o histórico fica guardado.`)) {
      return;
    }
    const { error } = await supabase().from("funcionarios").update({ ativo }).eq("id", funcionario.id);
    if (error) setErro("Não foi possível atualizar. Detalhe: " + error.message);
    else await carregar();
  }

  function editar(f: Funcionario) {
    abrir({
      id: f.id,
      nome: f.nome,
      funcao: f.funcao,
      telefone: f.telefone ?? "",
      hora_entrada: curta(f.hora_entrada),
      hora_saida: curta(f.hora_saida),
      inicio_almoco: curta(f.inicio_almoco),
      inicio_cafe: curta(f.inicio_cafe),
    });
  }

  const semanaFormulario = formulario
    ? minutosPorSemana({
        hora_entrada: formulario.hora_entrada || null,
        hora_saida: formulario.hora_saida || null,
        inicio_almoco: null,
        inicio_cafe: null,
      })
    : null;

  function campoHora(rotulo: string, chave: keyof Formulario) {
    if (!formulario) return null;
    return (
      <label className="block">
        <span className="mb-1 block font-medium">{rotulo}</span>
        <input
          className="campo"
          type="time"
          value={formulario[chave] ?? ""}
          onChange={(e) => setFormulario({ ...formulario, [chave]: e.target.value })}
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao" onClick={() => abrir(FORMULARIO_VAZIO)}>
            + Adicionar
          </button>
        )}
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      {formulario && (
        <form onSubmit={salvar} className="cartao space-y-3">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
            >
              {funcoes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
            />
          </label>

          <p className="pt-1 text-sm text-neutral-600">
            Horário de segunda a sexta. Entrada entre {RESTAURANTE.janelaEntrada.de} e{" "}
            {RESTAURANTE.janelaEntrada.ate}, saída entre {RESTAURANTE.janelaSaida.de} e{" "}
            {RESTAURANTE.janelaSaida.ate}. Máximo de {RESTAURANTE.maxHorasSemana}h por semana.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {campoHora("Entrada", "hora_entrada")}
            {campoHora("Saída", "hora_saida")}
            {campoHora("Almoço (1h)", "inicio_almoco")}
            {campoHora("Café (10 min)", "inicio_cafe")}
          </div>
          {semanaFormulario !== null && semanaFormulario > 0 && (
            <p
              className={`font-semibold ${
                semanaFormulario > RESTAURANTE.maxHorasSemana * 60 ? "text-red-700" : "text-green-700"
              }`}
            >
              Total na semana: {formatarHoras(semanaFormulario)}
            </p>
          )}

          {errosFormulario.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-red-50 p-3 text-red-700">
              {errosFormulario.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" className="botao-secundario" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <p className="text-neutral-600">Carregando...</p>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {["Todos", ...funcoes].map((f) => {
              const total = f === "Todos" ? ativos.length : ativos.filter((a) => a.funcao === f).length;
              const selecionado = filtro === f;
              return (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 font-semibold ${
                    selecionado ? "border-transparent text-white" : "border-neutral-300 bg-white"
                  }`}
                  style={selecionado ? { background: "var(--cor-principal)" } : undefined}
                >
                  {f} ({total})
                </button>
              );
            })}
          </div>

          {listados.length === 0 && !erro && (
            <p className="cartao text-neutral-600">Ninguém aqui ainda. Toque em “+ Adicionar”.</p>
          )}
          <ul className="space-y-3">
            {listados.map((f) => {
              const semana = minutosPorSemana(f);
              const horario = textoHorario(f);
              const passou = semana !== null && semana > RESTAURANTE.maxHorasSemana * 60;
              return (
                <li key={f.id} className="cartao">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{f.nome}</p>
                      <p className="text-neutral-700">{f.funcao}</p>
                    </div>
                    {semana !== null && (
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          passou ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {formatarHoras(semana)}/sem
                      </span>
                    )}
                  </div>
                  {horario ? (
                    <p className="mt-1 text-neutral-700">
                      {horario} · almoço {curta(f.inicio_almoco)} · café {curta(f.inicio_cafe)}
                    </p>
                  ) : (
                    <p className="mt-1 text-red-700">Sem horário: toque em Editar para preencher.</p>
                  )}
                  {f.telefone && (
                    <a
                      href={`tel:${f.telefone.replace(/\D/g, "")}`}
                      className="text-base underline"
                      style={{ color: "var(--cor-principal)" }}
                    >
                      {f.telefone}
                    </a>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button className="botao-secundario" onClick={() => editar(f)}>
                      Editar
                    </button>
                    <button className="botao-secundario" onClick={() => mudarAtivo(f, false)}>
                      Desativar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {desativados.length > 0 && (
            <section className="pt-2">
              <button
                className="botao-secundario w-full"
                onClick={() => setMostrarDesativados(!mostrarDesativados)}
              >
                {mostrarDesativados ? "Esconder" : "Ver"} desativados ({desativados.length})
              </button>
              {mostrarDesativados && (
                <ul className="mt-3 space-y-3">
                  {desativados.map((f) => (
                    <li key={f.id} className="cartao flex items-center justify-between gap-3 opacity-80">
                      <div>
                        <p className="font-semibold">{f.nome}</p>
                        <p className="text-neutral-600">{f.funcao}</p>
                      </div>
                      <button className="botao-secundario" onClick={() => mudarAtivo(f, true)}>
                        Reativar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
