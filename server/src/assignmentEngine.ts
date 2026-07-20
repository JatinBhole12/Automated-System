import type { Employee, Ticket } from "@prisma/client";

export type MatchStep = {
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
};

export type AssignmentDecision = {
  employee: Employee | null;
  score: number;
  reason: string;
  steps: MatchStep[];
};

function hasSkill(employee: Employee, requiredSkill: string) {
  return employee.skills
    .split(",")
    .map((skill) => skill.trim().toLowerCase())
    .includes(requiredSkill.toLowerCase());
}

function workloadBonus(employee: Employee, candidates: Employee[]) {
  const lowestWorkload = Math.min(...candidates.map((candidate) => candidate.activeTickets));
  return employee.activeTickets === lowestWorkload ? 10 : 0;
}

export function assignTicket(ticket: Ticket, employees: Employee[]): AssignmentDecision {
  const departmentMatches = employees.filter((employee) => employee.department === ticket.department);
  const availableInDepartment = departmentMatches.filter(
    (employee) => employee.availability && employee.activeTickets < employee.maxCapacity
  );
  const exactSkillMatches = availableInDepartment.filter((employee) => hasSkill(employee, ticket.requiredSkill));
  const candidatePool = exactSkillMatches.length > 0 ? exactSkillMatches : availableInDepartment;

  const baseSteps: MatchStep[] = [
    {
      label: "Department matched",
      status: departmentMatches.length > 0 ? "passed" : "failed",
      detail:
        departmentMatches.length > 0
          ? `${departmentMatches.length} employee(s) found in ${ticket.department}.`
          : `No employees found in ${ticket.department}.`
    },
    {
      label: "Skill matched",
      status: exactSkillMatches.length > 0 ? "passed" : "warning",
      detail:
        exactSkillMatches.length > 0
          ? `${exactSkillMatches.length} employee(s) have ${ticket.requiredSkill} skill.`
          : "No exact skill match found; same-department fallback will be used."
    },
    {
      label: "Availability checked",
      status: availableInDepartment.length > 0 ? "passed" : "failed",
      detail:
        availableInDepartment.length > 0
          ? `${availableInDepartment.length} available employee(s) are below capacity.`
          : "No available same-department employee is below max capacity."
    },
    {
      label: "Workload compared",
      status: candidatePool.length > 0 ? "passed" : "failed",
      detail:
        candidatePool.length > 0
          ? "Candidates were ranked by active ticket count."
          : "No candidate was available for workload comparison."
    }
  ];

  if (candidatePool.length === 0) {
    return {
      employee: null,
      score: 0,
      steps: [
        ...baseSteps,
        {
          label: "Final employee selected",
          status: "failed",
          detail: "Ticket marked as Unassigned."
        }
      ],
      reason: `No available ${ticket.department} employee is below capacity, so the ticket was marked Unassigned.`
    };
  }

  const rankedCandidates = [...candidatePool].sort((a, b) => a.activeTickets - b.activeTickets || a.name.localeCompare(b.name));
  const selectedEmployee = rankedCandidates[0];
  const exactSkill = hasSkill(selectedEmployee, ticket.requiredSkill);
  const score = 40 + (exactSkill ? 30 : 0) + 20 + workloadBonus(selectedEmployee, candidatePool);

  const skillReason = exactSkill
    ? `has ${ticket.requiredSkill} skill`
    : `does not have an exact ${ticket.requiredSkill} skill match but is the least busy available employee in ${ticket.department}`;

  return {
    employee: selectedEmployee,
    score,
    steps: [
      ...baseSteps,
      {
        label: "Final employee selected",
        status: "passed",
        detail: `${selectedEmployee.name} selected with ${selectedEmployee.activeTickets}/${selectedEmployee.maxCapacity} active tickets.`
      }
    ],
    reason: `Ticket assigned to ${selectedEmployee.name} because ${selectedEmployee.name} belongs to ${ticket.department} department, ${skillReason}, is available, and has the lowest workload.`
  };
}
