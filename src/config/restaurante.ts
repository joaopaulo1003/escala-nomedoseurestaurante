// Como o dono descreveu o restaurante. Este arquivo vale mais que qualquer padrão.
// As telas leem as regras daqui (horários, 42h semanais, pausas, funções).

export const RESTAURANTE = {
  nome: "Aneto",
  unidade: "Unidade Mooca",
  tipo: "Food service (café da manhã, almoço e lanche da tarde)",
  funcionamento: "Segunda a sexta",
  // Dias em que o restaurante abre: 0 = domingo ... 6 = sábado
  diasFuncionamento: [1, 2, 3, 4, 5],
  turnos: [
    { nome: "Café da manhã", horaInicio: "07:15", horaFim: "09:30" },
    { nome: "Almoço", horaInicio: "11:30", horaFim: "14:30" },
    { nome: "Lanche da tarde", horaInicio: "16:00", horaFim: "18:00" },
  ],
  funcoes: ["Cozinha", "Reposição", "Atendimento"],
  minimos:
    "Café da manhã: cozinha 25, reposição 6, atendimento 6. " +
    "Almoço: cozinha 25, reposição 6, atendimento 8. " +
    "Lanche da tarde: cozinha 4, reposição 2, atendimento 3.",
  escala: "5x2",
  folgasPorSemana: 2, // sábado e domingo
  podeFecharEAbrir: true,
  maxHorasSemana: 42,
  almocoMinutos: 60, // não conta como hora trabalhada
  cafeMinutos: 10, // conta como hora trabalhada (CLT)
  janelaEntrada: { de: "05:30", ate: "09:30" },
  janelaSaida: { de: "15:18", ate: "19:48" },
  regrasExtras: [
    "Escala 5x2 com folga no sábado e no domingo.",
    "Ninguém passa de 42 horas por semana.",
    "Todos têm 1 hora de almoço e 10 minutos de café, fora dos horários de serviço.",
    "A cozinha do café da manhã e do almoço é a mesma equipe; os turnos se intercalam.",
  ],
  corPrincipal: "#39824C",
  corSecundaria: "#F5F7F2",
  temLogo: true,
};
