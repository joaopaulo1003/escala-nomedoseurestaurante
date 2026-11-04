// Regras da jornada de trabalho (horas semanais, pausas, cobertura de turnos).
// Os números vêm de src/config/restaurante.ts.

import { RESTAURANTE } from "@/config/restaurante";
import { horaParaMinutos } from "@/lib/datas";
import type { Funcionario, Turno } from "@/lib/tipos";

export type Horario = {
  hora_entrada: string | null;
  hora_saida: string | null;
  inicio_almoco: string | null;
  inicio_cafe: string | null;
};

const DIAS_TRABALHO = RESTAURANTE.diasFuncionamento.length;

/** 125 -> "2h05" */
export function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** 545 -> "09:05" */
export function minutosParaHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Minutos trabalhados por dia: da entrada à saída, sem a hora de almoço. */
export function minutosPorDia(h: Horario): number | null {
  if (!h.hora_entrada || !h.hora_saida) return null;
  return horaParaMinutos(h.hora_saida) - horaParaMinutos(h.hora_entrada) - RESTAURANTE.almocoMinutos;
}

export function minutosPorSemana(h: Horario): number | null {
  const dia = minutosPorDia(h);
  return dia === null ? null : dia * DIAS_TRABALHO;
}

function sobrepoe(ini1: number, fim1: number, ini2: number, fim2: number) {
  return ini1 < fim2 && ini2 < fim1;
}

/** Pausas do funcionário em minutos: [início, fim]. */
function pausas(h: Horario): [number, number][] {
  const lista: [number, number][] = [];
  if (h.inicio_almoco) {
    const i = horaParaMinutos(h.inicio_almoco);
    lista.push([i, i + RESTAURANTE.almocoMinutos]);
  }
  if (h.inicio_cafe) {
    const i = horaParaMinutos(h.inicio_cafe);
    lista.push([i, i + RESTAURANTE.cafeMinutos]);
  }
  return lista;
}

/** Devolve a lista de problemas do horário (vazia = tudo certo). */
export function validarHorario(h: Horario, turnos: Turno[]): string[] {
  const erros: string[] = [];
  if (!h.hora_entrada || !h.hora_saida || !h.inicio_almoco || !h.inicio_cafe) {
    return ["Preencha entrada, saída, início do almoço e início do café."];
  }
  const ent = horaParaMinutos(h.hora_entrada);
  const sai = horaParaMinutos(h.hora_saida);
  const { janelaEntrada: je, janelaSaida: js } = RESTAURANTE;

  if (ent < horaParaMinutos(je.de) || ent > horaParaMinutos(je.ate)) {
    erros.push(`A entrada precisa ser entre ${je.de} e ${je.ate}.`);
  }
  if (sai < horaParaMinutos(js.de) || sai > horaParaMinutos(js.ate)) {
    erros.push(`A saída precisa ser entre ${js.de} e ${js.ate}.`);
  }
  const semana = minutosPorSemana(h)!;
  const limite = RESTAURANTE.maxHorasSemana * 60;
  if (semana > limite) {
    const maxPresenca = limite / DIAS_TRABALHO + RESTAURANTE.almocoMinutos;
    erros.push(
      `Passa de ${RESTAURANTE.maxHorasSemana}h por semana (${formatarHoras(semana)}). ` +
        `Com entrada às ${h.hora_entrada.slice(0, 5)}, a saída pode ser no máximo às ${minutosParaHora(ent + maxPresenca)}.`,
    );
  }
  for (const [ini, fim] of pausas(h)) {
    if (ini < ent || fim > sai) {
      erros.push("As pausas precisam ficar entre a entrada e a saída.");
      break;
    }
  }
  const [almoco, cafe] = pausas(h);
  if (sobrepoe(almoco[0], almoco[1], cafe[0], cafe[1])) {
    erros.push("O café não pode ser no mesmo horário do almoço.");
  }
  for (const t of turnos) {
    const ti = horaParaMinutos(t.hora_inicio);
    const tf = horaParaMinutos(t.hora_fim);
    if (pausas(h).some(([i, f]) => sobrepoe(i, f, ti, tf))) {
      erros.push(`Uma pausa cai no meio do ${t.nome} (${t.hora_inicio.slice(0, 5)}–${t.hora_fim.slice(0, 5)}).`);
    }
  }
  return erros;
}

/** O funcionário cobre o turno inteiro, sem estar em pausa? */
export function cobreTurno(f: Funcionario, t: Turno): boolean {
  if (!f.hora_entrada || !f.hora_saida) return false;
  const ti = horaParaMinutos(t.hora_inicio);
  const tf = horaParaMinutos(t.hora_fim);
  if (horaParaMinutos(f.hora_entrada) > ti || horaParaMinutos(f.hora_saida) < tf) return false;
  return !pausas(f).some(([i, fim]) => sobrepoe(i, fim, ti, tf));
}

/** "06:00–15:24" */
export function textoHorario(h: Horario): string | null {
  if (!h.hora_entrada || !h.hora_saida) return null;
  return `${h.hora_entrada.slice(0, 5)}–${h.hora_saida.slice(0, 5)}`;
}
