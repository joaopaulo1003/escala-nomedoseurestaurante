-- =====================================================================
-- Aneto · Unidade Mooca: dados reais de funcionamento + equipe fictícia
-- Cole no SQL Editor do Supabase e clique em Run (pode rodar mais de uma vez).
-- =====================================================================

-- 1) Horário fixo de cada funcionário (segunda a sexta)
alter table funcionarios
  add column if not exists hora_entrada time,
  add column if not exists hora_saida time,
  add column if not exists inicio_almoco time,
  add column if not exists inicio_cafe time;

-- 2) Turnos da unidade (o Jantar não existe aqui)
insert into turnos (nome, hora_inicio, hora_fim, ordem) values
  ('Café da manhã',   '07:15', '09:30', 1),
  ('Almoço',          '11:30', '14:30', 2),
  ('Lanche da tarde', '16:00', '18:00', 3)
on conflict (nome) do update
  set hora_inicio = excluded.hora_inicio, hora_fim = excluded.hora_fim, ordem = excluded.ordem;
delete from turnos where nome = 'Jantar';

-- 3) Mínimo de pessoas por turno e função (vale para todos os dias)
delete from regras;
insert into regras (dia_semana, turno_id, funcao, minimo)
select null, t.id, r.funcao, r.minimo
from (values
  ('Café da manhã',   'Cozinha', 25), ('Café da manhã',   'Reposição', 6), ('Café da manhã',   'Atendimento', 6),
  ('Almoço',          'Cozinha', 25), ('Almoço',          'Reposição', 6), ('Almoço',          'Atendimento', 8),
  ('Lanche da tarde', 'Cozinha', 4),  ('Lanche da tarde', 'Reposição', 2), ('Lanche da tarde', 'Atendimento', 3)
) as r(turno, funcao, minimo)
join turnos t on t.nome = r.turno;

-- 4) Funcionários de exemplo (Vila Tempero) ficam desativados, não apagados
update funcionarios set ativo = false
where cpf in ('12345678901','23456789012','34567890123','45678901234',
              '56789012345','67890123456','78901234567','89012345678');

-- 5) Equipe fictícia: 46 pessoas, todas com 42h semanais (9h24 entre entrada e saída,
--    1h de almoço que não conta). Pausas sempre fora dos horários de serviço.
--    Manhã (café + almoço): 25 cozinha, 6 reposição, 6 atendimento.
--    Tarde (almoço + lanche): 4 cozinha, 2 reposição, 3 atendimento.
insert into funcionarios (nome, funcao, telefone, hora_entrada, hora_saida, inicio_almoco, inicio_cafe)
select v.nome, v.funcao, v.telefone, v.hora_entrada::time, v.hora_saida::time, v.inicio_almoco::time, v.inicio_cafe::time from (values
  ('Adriana Batista', 'Cozinha', '(11) 95100-4100', '05:54', '15:18', '09:35', '14:35'),
  ('Alexandre Moura', 'Cozinha', '(11) 95101-4107', '05:54', '15:18', '09:35', '14:35'),
  ('Aline Ferreira', 'Cozinha', '(11) 95102-4114', '05:54', '15:18', '09:35', '14:35'),
  ('André Cardoso', 'Cozinha', '(11) 95103-4121', '05:54', '15:18', '09:35', '14:35'),
  ('Beatriz Ramos', 'Cozinha', '(11) 95104-4128', '05:54', '15:18', '09:35', '14:35'),
  ('Caio Teixeira', 'Cozinha', '(11) 95105-4135', '05:54', '15:18', '09:35', '14:35'),
  ('Camila Duarte', 'Cozinha', '(11) 95106-4142', '05:54', '15:18', '09:35', '14:35'),
  ('Carlos Pacheco', 'Cozinha', '(11) 95107-4149', '05:54', '15:18', '09:35', '14:35'),
  ('Cíntia Freitas', 'Cozinha', '(11) 95108-4156', '05:54', '15:18', '09:35', '14:35'),
  ('Cláudio Barros', 'Cozinha', '(11) 95109-4163', '06:15', '15:39', '09:50', '14:40'),
  ('Daniela Pires', 'Cozinha', '(11) 95110-4170', '06:15', '15:39', '09:50', '14:40'),
  ('Douglas Martins', 'Cozinha', '(11) 95111-4177', '06:15', '15:39', '09:50', '14:40'),
  ('Edson Vieira', 'Cozinha', '(11) 95112-4184', '06:15', '15:39', '09:50', '14:40'),
  ('Eliane Prado', 'Cozinha', '(11) 95113-4191', '06:15', '15:39', '09:50', '14:40'),
  ('Emerson Lopes', 'Cozinha', '(11) 95114-4198', '06:15', '15:39', '09:50', '14:40'),
  ('Fabiana Araújo', 'Cozinha', '(11) 95115-4205', '06:15', '15:39', '09:50', '14:40'),
  ('Felipe Campos', 'Cozinha', '(11) 95116-4212', '06:15', '15:39', '09:50', '14:40'),
  ('Fernanda Rezende', 'Cozinha', '(11) 95117-4219', '06:30', '15:54', '10:25', '14:50'),
  ('Gilberto Santana', 'Cozinha', '(11) 95118-4226', '06:30', '15:54', '10:25', '14:50'),
  ('Giovana Leite', 'Cozinha', '(11) 95119-4233', '06:30', '15:54', '10:25', '14:50'),
  ('Gustavo Peixoto', 'Cozinha', '(11) 95120-4240', '06:30', '15:54', '10:25', '14:50'),
  ('Helena Macedo', 'Cozinha', '(11) 95121-4247', '06:30', '15:54', '10:25', '14:50'),
  ('Igor Monteiro', 'Cozinha', '(11) 95122-4254', '06:30', '15:54', '10:25', '14:50'),
  ('Isabela Cunha', 'Cozinha', '(11) 95123-4261', '06:30', '15:54', '10:25', '14:50'),
  ('Jéssica Moreira', 'Cozinha', '(11) 95124-4268', '06:30', '15:54', '10:25', '14:50'),
  ('Jonas Brito', 'Reposição', '(11) 95125-4275', '06:00', '15:24', '09:40', '14:35'),
  ('Juliana Castro', 'Reposição', '(11) 95126-4282', '06:00', '15:24', '09:40', '14:35'),
  ('Kátia Rangel', 'Reposição', '(11) 95127-4289', '06:00', '15:24', '09:40', '14:35'),
  ('Leandro Farias', 'Reposição', '(11) 95128-4296', '06:00', '15:24', '09:40', '14:35'),
  ('Letícia Assis', 'Reposição', '(11) 95129-4303', '06:00', '15:24', '09:40', '14:35'),
  ('Luciano Gomes', 'Reposição', '(11) 95130-4310', '06:00', '15:24', '09:40', '14:35'),
  ('Marcela Tavares', 'Atendimento', '(11) 95131-4317', '06:40', '16:04', '10:15', '14:45'),
  ('Mário Siqueira', 'Atendimento', '(11) 95132-4324', '06:40', '16:04', '10:15', '14:45'),
  ('Michele Andrade', 'Atendimento', '(11) 95133-4331', '06:40', '16:04', '10:15', '14:45'),
  ('Natália Bezerra', 'Atendimento', '(11) 95134-4338', '06:40', '16:04', '10:15', '14:45'),
  ('Otávio Fontes', 'Atendimento', '(11) 95135-4345', '06:40', '16:04', '10:15', '14:45'),
  ('Patrícia Sales', 'Atendimento', '(11) 95136-4352', '06:40', '16:04', '10:15', '14:45'),
  ('Paulo Henrique Reis', 'Cozinha', '(11) 95137-4359', '08:36', '18:00', '14:40', '15:45'),
  ('Priscila Matos', 'Cozinha', '(11) 95138-4366', '08:36', '18:00', '14:40', '15:45'),
  ('Rafael Coelho', 'Cozinha', '(11) 95139-4373', '08:36', '18:00', '14:40', '15:45'),
  ('Renata Guimarães', 'Cozinha', '(11) 95140-4380', '08:36', '18:00', '14:40', '15:45'),
  ('Ricardo Antunes', 'Reposição', '(11) 95141-4387', '08:45', '18:09', '14:45', '15:48'),
  ('Rosana Paiva', 'Reposição', '(11) 95142-4394', '08:45', '18:09', '14:45', '15:48'),
  ('Sérgio Nogueira', 'Atendimento', '(11) 95143-4401', '09:00', '18:24', '14:40', '15:45'),
  ('Tatiane Lacerda', 'Atendimento', '(11) 95144-4408', '09:00', '18:24', '14:40', '15:45'),
  ('Vinícius Amaral', 'Atendimento', '(11) 95145-4415', '09:00', '18:24', '14:40', '15:45')
) as v(nome, funcao, telefone, hora_entrada, hora_saida, inicio_almoco, inicio_cafe)
where not exists (select 1 from funcionarios f where f.nome = v.nome);
