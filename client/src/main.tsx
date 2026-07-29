import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  ListChecks,
  LockKeyhole,
  LogOut,
  Loader2,
  Mail,
  PlugZap,
  Plus,
  RotateCw,
  Search,
  Send,
  Sparkles,
  ShieldCheck,
  Timer,
  Trash2,
  X,
  UserCheck,
  UserRound,
  UsersRound
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
const SESSION_KEY = "autoassign.registeredUser";
const PENDING_REGISTRATION_KEY = "autoassign.pendingRegistration";
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

type RegisteredUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  approvalStatus: string;
};

type PendingRegistration = {
  name: string;
  email: string;
};

type Employee = {
  id: number;
  name: string;
  department: string;
  skills: string;
  availability: boolean;
  activeTickets: number;
  maxCapacity: number;
};

type Ticket = {
  id: number;
  title: string;
  department: string;
  materialType: string;
  requiredSkill: string;
  priority: "Low" | "Medium" | "High";
  topic?: string | null;
  subject: string;
  customerMessage?: string | null;
  hubOrderNo?: string | null;
  materialNo?: string | null;
  supplierEntity?: string | null;
  shippingType?: string | null;
  shippingDate?: string | null;
  autoObdRelease?: boolean | null;
  hasUserStatusBlock?: boolean;
  itemStatus?: number | null;
  deliveryDate?: string | null;
  purchaseGroup?: string | null;
  isKit?: boolean;
  orderStatus?: number | null;
  customerCenterInsisting?: boolean;
  plannerName?: string | null;
  plannerApprovedCancellation?: boolean | null;
  recommendedAction?: string | null;
  routedTeam?: string | null;
  status: string;
  assignedTo?: Employee | null;
  reason?: string | null;
  score?: number | null;
};

type MatchStep = {
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
};

type Assignment = {
  id: number;
  score: number;
  reason: string;
  steps: MatchStep[];
  createdAt: string;
  ticket: Ticket;
  employee?: Employee | null;
};

type IntegrationResult = {
  accepted: boolean;
  externalTicketId?: string | null;
  sourceSystem?: string;
  ticketId: number;
  status: string;
  recommendedAction?: string | null;
  routedTeam?: string | null;
  assignedEmployee?: Employee | null;
  score: number;
  reason: string;
  steps: MatchStep[];
  ticket: Ticket;
};

type View = "tickets" | "employees" | "integrations" | "engine" | "results" | "profile";
type PriorityFilter = "All" | Ticket["priority"];
type TicketPayload = Pick<
  Ticket,
  | "title"
  | "department"
  | "materialType"
  | "requiredSkill"
  | "priority"
  | "topic"
  | "subject"
  | "customerMessage"
  | "hubOrderNo"
  | "materialNo"
  | "supplierEntity"
  | "shippingType"
  | "shippingDate"
  | "autoObdRelease"
  | "hasUserStatusBlock"
  | "itemStatus"
  | "deliveryDate"
  | "purchaseGroup"
  | "isKit"
  | "orderStatus"
  | "customerCenterInsisting"
  | "plannerName"
  | "plannerApprovedCancellation"
>;
type ExternalTicketPayload = TicketPayload & {
  externalTicketId: string;
  sourceSystem: string;
};

const navItems: Array<{ id: View; label: string; hint: string; icon: React.ReactNode }> = [
  { id: "tickets", label: "Tickets", hint: "Queue triage", icon: <ClipboardList size={18} /> },
  { id: "employees", label: "Team", hint: "Capacity view", icon: <UsersRound size={18} /> },
  { id: "integrations", label: "Intake", hint: "External tickets", icon: <PlugZap size={18} /> },
  { id: "engine", label: "Engine", hint: "Decision trace", icon: <Cpu size={18} /> },
  { id: "results", label: "Results", hint: "Recent matches", icon: <ListChecks size={18} /> },
  { id: "profile", label: "Profile", hint: "Account details", icon: <UserRound size={18} /> }
];

const priorityOrder: Record<Ticket["priority"], number> = { High: 0, Medium: 1, Low: 2 };
const subjects = [
  "Delivery Date",
  "ETA",
  "AOQ Error",
  "Stock Reallocation",
  "Material Not Live",
  "Lead Time",
  "Certificate",
  "Order Cancellation"
];

function isSuperAdmin(user: RegisteredUser) {
  return user.role === SUPER_ADMIN_ROLE;
}

function parseStoredUser(saved: string | null) {
  if (!saved) return null;

  try {
    return JSON.parse(saved) as RegisteredUser;
  } catch {
    return null;
  }
}

function readStoredUser() {
  const persistentUser = parseStoredUser(window.localStorage.getItem(SESSION_KEY));

  if (persistentUser) {
    if (isSuperAdmin(persistentUser)) {
      return persistentUser;
    }

    window.localStorage.removeItem(SESSION_KEY);
  }

  const sessionUser = parseStoredUser(window.sessionStorage.getItem(SESSION_KEY));
  if (!sessionUser) {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }

  if (isSuperAdmin(sessionUser)) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  return sessionUser;
}

function storeRegisteredUser(user: RegisteredUser) {
  const serializedUser = JSON.stringify(user);

  if (isSuperAdmin(user)) {
    window.localStorage.setItem(SESSION_KEY, serializedUser);
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, serializedUser);
  window.localStorage.removeItem(SESSION_KEY);
}

function clearStoredUser() {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

function App() {
  const [registeredUser, setRegisteredUser] = React.useState<RegisteredUser | null>(() => readStoredUser());
  const [view, setView] = React.useState<View>("tickets");
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = React.useState<Assignment | null>(null);
  const [openTicket, setOpenTicket] = React.useState<Ticket | null>(null);
  const [loadingTicketId, setLoadingTicketId] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("All");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [creatingTicket, setCreatingTicket] = React.useState(false);
  const [receivingExternalTicket, setReceivingExternalTicket] = React.useState(false);
  const [integrationResult, setIntegrationResult] = React.useState<IntegrationResult | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  async function loadData() {
    setLoadError(null);
    const [ticketResponse, employeeResponse, assignmentResponse] = await Promise.all([
      fetch(`${API_BASE}/tickets`),
      fetch(`${API_BASE}/employees`),
      fetch(`${API_BASE}/assignments`)
    ]);

    if (!ticketResponse.ok || !employeeResponse.ok || !assignmentResponse.ok) {
      throw new Error("Unable to load dashboard data.");
    }

    const [ticketData, employeeData, assignmentData] = await Promise.all([
      ticketResponse.json(),
      employeeResponse.json(),
      assignmentResponse.json()
    ]) as [Ticket[], Employee[], Assignment[]];

    setTickets(ticketData);
    setEmployees(employeeData);
    setAssignments(assignmentData);
    setSelectedAssignment((current) => current ?? assignmentData[0] ?? null);
    setOpenTicket((current) => {
      if (!current) return null;
      return ticketData.find((ticket) => ticket.id === current.id) ?? null;
    });
  }

  React.useEffect(() => {
    loadData().catch((error) => {
      console.error(error);
      setLoadError("The dashboard could not reach the ticket assignment API.");
    });
  }, []);

  async function runAssignment(ticketId: number) {
    setLoadingTicketId(ticketId);
    try {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/resolve`, { method: "POST" });
      if (!response.ok) throw new Error("Assignment failed.");
      const payload = await response.json();
      await loadData();
      setSelectedAssignment({ ...payload.assignment, steps: payload.steps });
      setView("results");
    } catch (error) {
      console.error(error);
      setLoadError("The assignment engine could not complete this request.");
    } finally {
      setLoadingTicketId(null);
    }
  }

  async function createTicket(payload: TicketPayload, autoAssign: boolean) {
    setCreatingTicket(true);
    try {
      const response = await fetch(`${API_BASE}/tickets${autoAssign ? "?autoResolve=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Ticket creation failed.");
      const created = await response.json();

      if (autoAssign) {
        await loadData();
        setSelectedAssignment({ ...created.assignment, steps: created.steps });
        setView("results");
        return;
      }

      await loadData();
      setView("tickets");
    } catch (error) {
      console.error(error);
      setLoadError("The ticket could not be created.");
    } finally {
      setCreatingTicket(false);
    }
  }

  async function receiveExternalTicket(payload: ExternalTicketPayload) {
    setReceivingExternalTicket(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE}/integrations/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("External intake failed.");
      const result = await response.json() as IntegrationResult;
      setIntegrationResult(result);
      await loadData();
      const latest = await fetch(`${API_BASE}/assignments`).then((assignmentResponse) => assignmentResponse.json() as Promise<Assignment[]>);
      setSelectedAssignment(latest[0] ?? null);
    } catch (error) {
      console.error(error);
      setLoadError("The external ticket could not be received or assigned.");
    } finally {
      setReceivingExternalTicket(false);
    }
  }

  async function refreshData() {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error(error);
      setLoadError("The dashboard could not refresh data.");
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteTicket(ticketId: number) {
    const shouldDelete = window.confirm("Delete this ticket and its assignment history?");
    if (!shouldDelete) return;

    try {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Ticket deletion failed.");

      const remainingAssignments = assignments.filter((assignment) => assignment.ticket.id !== ticketId);
      setAssignments(remainingAssignments);
      setTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
      setOpenTicket((current) => (current?.id === ticketId ? null : current));
      setSelectedAssignment((current) => {
        if (current?.ticket.id !== ticketId) return current;
        return remainingAssignments[0] ?? null;
      });
      await loadData();
    } catch (error) {
      console.error(error);
      setLoadError("The ticket could not be deleted.");
    }
  }

  const filteredTickets = React.useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return [...tickets]
      .filter((ticket) => priorityFilter === "All" || ticket.priority === priorityFilter)
      .filter((ticket) => {
        if (!normalized) return true;
        return [
          ticket.title,
          ticket.topic ?? "",
          ticket.department,
          ticket.materialNo ?? "",
          ticket.materialType,
          ticket.requiredSkill,
          ticket.supplierEntity ?? "",
          ticket.assignedTo?.name ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.id - b.id);
  }, [priorityFilter, searchTerm, tickets]);

  const latestAssignment = selectedAssignment ?? assignments[0] ?? null;
  const openTicketAssignment = openTicket ? assignments.find((assignment) => assignment.ticket.id === openTicket.id) ?? null : null;
  function signOut() {
    clearStoredUser();
    window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
    setRegisteredUser(null);
    setView("tickets");
  }

  if (!registeredUser) {
    return (
      <RegistrationGate
        onComplete={(user) => {
          storeRegisteredUser(user);
          setRegisteredUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cloud text-ink">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <Sidebar view={view} user={registeredUser} onChange={setView} onSignOut={signOut} />

        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-7">
          <WorkspaceHeader view={view} tickets={tickets} employees={employees} assignments={assignments} />
          {loadError && <Notice message={loadError} />}
          <Summary tickets={tickets} employees={employees} assignments={assignments} />

          {view === "tickets" && (
            <IncomingTickets
              tickets={filteredTickets}
              allTickets={tickets}
              searchTerm={searchTerm}
              priorityFilter={priorityFilter}
              onSearchChange={setSearchTerm}
              onPriorityChange={setPriorityFilter}
              onAssign={runAssignment}
              onCreateTicket={createTicket}
              onRefresh={refreshData}
              onOpenTicket={setOpenTicket}
              employees={employees}
              creatingTicket={creatingTicket}
              refreshing={refreshing}
              loadingTicketId={loadingTicketId}
            />
          )}
          {view === "employees" && <EmployeePool employees={employees} tickets={tickets} />}
          {view === "integrations" && (
            <ExternalIntake
              employees={employees}
              result={integrationResult}
              submitting={receivingExternalTicket}
              onSubmit={receiveExternalTicket}
            />
          )}
          {view === "engine" && <AssignmentEngine assignment={latestAssignment} />}
          {view === "results" && (
            <AssignmentResults
              assignment={latestAssignment}
              assignments={assignments}
              onSelect={setSelectedAssignment}
              onDeleteTicket={deleteTicket}
            />
          )}
          {view === "profile" && <ProfileSection user={registeredUser} tickets={tickets} assignments={assignments} onSignOut={signOut} />}
        </main>
      </div>
      {openTicket && (
        <TicketDetailsDrawer
          ticket={openTicket}
          assignment={openTicketAssignment}
          resolving={loadingTicketId === openTicket.id}
          onClose={() => setOpenTicket(null)}
          onResolve={() => runAssignment(openTicket.id)}
          onDelete={() => deleteTicket(openTicket.id)}
        />
      )}
    </div>
  );
}

function Sidebar({
  view,
  user,
  onChange,
  onSignOut
}: {
  view: View;
  user: RegisteredUser;
  onChange: (view: View) => void;
  onSignOut: () => void;
}) {
  return (
    <aside className="flex flex-col border-b border-slate-800 bg-ink px-4 py-4 text-white xl:sticky xl:top-0 xl:h-screen xl:w-72 xl:border-b-0 xl:border-r">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-400 text-ink shadow-soft">
          <CheckCircle2 size={21} />
        </div>
        <div>
          <h1 className="text-lg font-bold">AutoAssign</h1>
          <p className="text-xs font-medium text-white/55">Ticket routing workspace</p>
        </div>
      </div>

      <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
              view === item.id ? "bg-white text-ink shadow-soft" : "text-white/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                view === item.id ? "bg-cyan-50 text-cyan-700" : "bg-white/8 text-white/70"
              }`}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className={`block text-xs ${view === item.id ? "text-slate-500" : "text-white/38"}`}>{item.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/6 p-4">
        <div className="mb-3 flex items-center gap-2 text-cyan-200">
          <Sparkles size={16} />
          <p className="text-sm font-bold">Rule based routing</p>
        </div>
        <p className="text-sm leading-6 text-white/55">
          Matches department, skill, availability, and workload to pick a practical assignee.
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/6 p-3 xl:mt-auto">
        <button
          type="button"
          onClick={() => onChange("profile")}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/8"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-400 text-sm font-black text-ink">
            {getInitials(user.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{user.name}</span>
            <span className="block truncate text-xs text-white/45">{user.email}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-bold text-white/70 transition hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-rose-100"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "U";
}

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function ProfileSection({
  user,
  tickets,
  assignments,
  onSignOut
}: {
  user: RegisteredUser;
  tickets: Ticket[];
  assignments: Assignment[];
  onSignOut: () => void;
}) {
  const assignedTickets = tickets.filter((ticket) => ticket.status === "Assigned").length;
  const latestAssignment = assignments[0];

  return (
    <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-line bg-white shadow-panel">
        <div className="border-b border-line p-5">
          <p className="text-xs font-bold uppercase text-slate-500">Profile</p>
          <h3 className="mt-1 text-xl font-bold">Account details</h3>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-cyan-400 text-xl font-black text-ink shadow-soft">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-2xl font-bold">{user.name}</h4>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ProfileInfo label="Role" value={formatRole(user.role)} />
            <ProfileInfo label="Access" value={user.approvalStatus === "APPROVED" ? "Approved" : user.approvalStatus} />
            <ProfileInfo label="Workspace" value="AutoAssign" />
            <ProfileInfo label="Session" value="Signed in" />
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <p className="text-xs font-bold uppercase text-slate-500">Activity</p>
          <h3 className="mt-1 text-xl font-bold">Workspace snapshot</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ProfileStat label="Tickets" value={tickets.length} icon={<ClipboardList size={18} />} />
            <ProfileStat label="Assigned" value={assignedTickets} icon={<CheckCircle2 size={18} />} />
            <ProfileStat label="Runs" value={assignments.length} icon={<ListChecks size={18} />} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <p className="text-xs font-bold uppercase text-slate-500">Latest work</p>
          {latestAssignment ? (
            <div className="mt-3 rounded-lg border border-line bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-base font-bold">{latestAssignment.ticket.title}</h4>
                  <p className="mt-1 text-sm text-slate-500">{latestAssignment.ticket.routedTeam ?? latestAssignment.employee?.name ?? "Routing completed"}</p>
                </div>
                <ScorePill score={latestAssignment.score} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{latestAssignment.reason}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-line bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              No assignment activity yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function ProfileStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between text-cyan-700">
        <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function RegistrationGate({ onComplete }: { onComplete: (user: RegisteredUser) => void }) {
  const pendingRegistration = React.useMemo<PendingRegistration | null>(() => {
    const saved = window.localStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved) as PendingRegistration;
    } catch {
      window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
      return null;
    }
  }, []);
  const [step, setStep] = React.useState<"email" | "otp" | "password" | "pending">(pendingRegistration ? "pending" : "email");
  const [name, setName] = React.useState(pendingRegistration?.name ?? "");
  const [email, setEmail] = React.useState(pendingRegistration?.email ?? "");
  const [otp, setOtp] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [registrationToken, setRegistrationToken] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resendingApproval, setResendingApproval] = React.useState(false);

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE}/auth/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not send OTP.");

      setNotice("OTP sent. Check your email inbox and enter the 6 digit code.");
      setStep("otp");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE}/auth/register/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "OTP verification failed.");

      setRegistrationToken(payload.registrationToken);
      setNotice("Email verified successfully. You can now create a password.");
      setStep("password");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OTP verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, registrationToken })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Registration failed.");

      if (payload.user.approvalStatus === "APPROVED") {
        window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
        onComplete(payload.user);
        return;
      }

      window.localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({ name, email }));
      setNotice("Registration submitted. Please wait for super admin approval.");
      setStep("pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkApprovalStatus() {
    if (!email) return;

    try {
      const response = await fetch(`${API_BASE}/auth/approval-status?email=${encodeURIComponent(email)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not check approval status.");

      if (payload.approvalStatus === "APPROVED" && payload.user) {
        window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
        setNotice("Approved. Opening workspace...");
        onComplete(payload.user);
        return;
      }

      if (payload.approvalStatus === "REJECTED") {
        window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
        setError("Your registration was rejected by the super admin.");
        setStep("email");
      }
    } catch (caught) {
      console.error(caught);
    }
  }

  async function resendApprovalEmail() {
    if (!email) return;

    setResendingApproval(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`${API_BASE}/auth/approval/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not resend approval email.");

      setNotice(payload.message ?? "A fresh approval email was sent to the super admin.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend approval email.");
    } finally {
      setResendingApproval(false);
    }
  }

  React.useEffect(() => {
    if (step !== "pending") return;
    if (email) {
      window.localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({ name, email }));
    }

    checkApprovalStatus();
    const intervalId = window.setInterval(checkApprovalStatus, 3000);
    return () => window.clearInterval(intervalId);
  }, [step, email]);

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-line bg-white shadow-2xl lg:grid-cols-[0.88fr_1.12fr]">
        <div className="bg-ink p-8 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-400 text-ink shadow-soft">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h1 className="text-xl font-bold">AutoAssign</h1>
              <p className="text-sm text-white/55">Secure registration</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight">Verify your email before opening the ticket workspace.</h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Password creation stays locked until the correct email OTP is verified.
          </p>
          <div className="mt-8 grid gap-3">
            <StepPill active={step === "email"} complete={step !== "email"} icon={<UserRound size={16} />} label="Name and email" />
            <StepPill active={step === "otp"} complete={step === "password" || step === "pending"} icon={<Mail size={16} />} label="Email OTP verification" />
            <StepPill active={step === "password"} complete={step === "pending"} icon={<LockKeyhole size={16} />} label="Create password" />
            <StepPill active={step === "pending"} complete={false} icon={<ShieldCheck size={16} />} label="Admin approval" />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase text-slate-500">Registration</p>
          <h2 className="mt-1 text-2xl font-bold">
            {step === "email"
              ? "Create your account"
              : step === "otp"
                ? "Verify email OTP"
                : step === "password"
                  ? "Create password"
                  : "Approval pending"}
          </h2>
          {notice && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}
          {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

          {step === "email" && (
            <form onSubmit={submitEmail} className="mt-6 grid gap-4">
              <Field label="Name">
                <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Your full name" className="field-input auth-input" />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" placeholder="name@company.com" className="field-input auth-input" />
              </Field>
              <button type="submit" disabled={submitting} className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <Mail size={17} />}
                Send OTP
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={submitOtp} className="mt-6 grid gap-4">
              <Field label="Email">
                <input value={email} readOnly className="field-input auth-input bg-slate-50" />
              </Field>
              <Field label="OTP">
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" minLength={6} maxLength={6} placeholder="6 digit OTP" className="field-input auth-input text-center tracking-[0.45em]" />
              </Field>
              <button type="submit" disabled={submitting || otp.length !== 6} className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
                Verify OTP
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={submitPassword} className="mt-6 grid gap-4">
              <Field label="Password">
                <div className="relative">
                  <input value={password} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} minLength={8} placeholder="Minimum 8 characters" className="field-input auth-input pr-12" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-slate-500 transition hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm password">
                <div className="relative">
                  <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required type={showConfirmPassword ? "text" : "password"} minLength={8} placeholder="Re-enter password" className="field-input auth-input pr-12" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    title={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute inset-y-0 right-3 inline-flex items-center justify-center text-slate-500 transition hover:text-ink"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <button type="submit" disabled={submitting} className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60">
                {submitting ? <Loader2 className="animate-spin" size={17} /> : <LockKeyhole size={17} />}
                Complete registration
              </button>
            </form>
          )}

          {step === "pending" && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <Timer size={20} />
              </div>
              <h3 className="text-lg font-bold text-ink">Waiting for super admin approval</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your email OTP and password setup are complete. The super admin has received an approval email. You can access the workspace after approval.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={checkApprovalStatus}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  <RotateCw size={16} />
                  Check approval now
                </button>
                <button
                  type="button"
                  onClick={resendApprovalEmail}
                  disabled={resendingApproval}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-ink transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {resendingApproval ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Resend approval email
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StepPill({ active, complete, icon, label }: { active: boolean; complete: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${active ? "border-cyan-300 bg-cyan-400/12 text-white" : complete ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/5 text-white/55"}`}>
      <span className={`grid h-8 w-8 place-items-center rounded-md ${active ? "bg-cyan-400 text-ink" : complete ? "bg-emerald-400 text-ink" : "bg-white/10 text-white/60"}`}>
        {complete ? <CheckCircle2 size={16} /> : icon}
      </span>
      <span className="text-sm font-bold">{label}</span>
    </div>
  );
}

function WorkspaceHeader({
  view,
  tickets,
  employees,
  assignments
}: {
  view: View;
  tickets: Ticket[];
  employees: Employee[];
  assignments: Assignment[];
}) {
  const unassigned = tickets.filter((ticket) => ticket.status !== "Assigned").length;
  const available = employees.filter((employee) => isEmployeeAvailable(employee)).length;
  const averageScore = assignments.length
    ? Math.round(assignments.reduce((total, assignment) => total + assignment.score, 0) / assignments.length)
    : 0;
  const title = navItems.find((item) => item.id === view)?.label ?? "Workspace";

  return (
    <section className="mb-4 flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-line">
          <Activity size={13} />
          Live operations
        </div>
        <h2 className="text-2xl font-bold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">Manage request routing, capacity, and assignment decisions.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
        <HeaderStat label="Open" value={unassigned} icon={<Timer size={16} />} />
        <HeaderStat label="Ready" value={available} icon={<UserCheck size={16} />} />
        <HeaderStat label="Score" value={averageScore ? `${averageScore}` : "-"} icon={<Gauge size={16} />} />
      </div>
    </section>
  );
}

function HeaderStat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3 shadow-panel">
      <div className="mb-2 flex items-center justify-between text-slate-400">
        <span className="text-[11px] font-bold uppercase">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function Summary({
  tickets,
  employees,
  assignments
}: {
  tickets: Ticket[];
  employees: Employee[];
  assignments: Assignment[];
}) {
  const assigned = tickets.filter((ticket) => ticket.status === "Assigned").length;
  const highPriority = tickets.filter((ticket) => ticket.priority === "High" && ticket.status !== "Assigned").length;
  const overloaded = employees.filter((employee) => employee.activeTickets >= employee.maxCapacity).length;
  const available = employees.filter((employee) => isEmployeeAvailable(employee)).length;

  return (
    <section className="mb-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      <Metric label="Total tickets" value={tickets.length} detail={`${assigned} assigned`} tone="cyan" icon={<ClipboardList size={18} />} />
      <Metric label="High priority open" value={highPriority} detail="Needs fast review" tone="rose" icon={<AlertTriangle size={18} />} />
      <Metric label="Ready employees" value={available} detail={`${overloaded} at capacity`} tone="emerald" icon={<UsersRound size={18} />} />
      <Metric label="Assignments run" value={assignments.length} detail="Decision history" tone="amber" icon={<ListChecks size={18} />} />
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
  icon
}: {
  label: string;
  value: number;
  detail: string;
  tone: "cyan" | "rose" | "emerald" | "amber";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <div className={`metric-icon metric-${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

function IncomingTickets({
  tickets,
  allTickets,
  employees,
  searchTerm,
  priorityFilter,
  onSearchChange,
  onPriorityChange,
  onAssign,
  onCreateTicket,
  onRefresh,
  onOpenTicket,
  creatingTicket,
  refreshing,
  loadingTicketId
}: {
  tickets: Ticket[];
  allTickets: Ticket[];
  employees: Employee[];
  searchTerm: string;
  priorityFilter: PriorityFilter;
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: PriorityFilter) => void;
  onAssign: (ticketId: number) => void;
  onCreateTicket: (payload: TicketPayload, autoAssign: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenTicket: (ticket: Ticket) => void;
  creatingTicket: boolean;
  refreshing: boolean;
  loadingTicketId: number | null;
}) {
  const [showForm, setShowForm] = React.useState(false);

  return (
    <Surface
      eyebrow="Queue"
      title="Incoming Tickets"
      action={
        <div className="flex flex-col gap-2 lg:flex-row">
          <button
            onClick={() => setShowForm((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close" : "New Ticket"}
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RotateCw className={refreshing ? "animate-spin" : ""} size={16} />
            Refresh
          </button>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search tickets"
              className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 sm:w-64"
            />
          </label>
          <select
            value={priorityFilter}
            onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          >
            {["All", "High", "Medium", "Low"].map((priority) => (
              <option key={priority} value={priority}>
                {priority} priority
              </option>
            ))}
          </select>
        </div>
      }
    >
      {showForm && (
        <CreateTicketForm
          employees={employees}
          saving={creatingTicket}
          onCancel={() => setShowForm(false)}
          onSubmit={async (payload, autoAssign) => {
            await onCreateTicket(payload, autoAssign);
            setShowForm(false);
          }}
        />
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="font-bold text-ink">{tickets.length}</span>
        <span>shown from {allTickets.length} tickets</span>
      </div>
      <ResponsiveTable>
        <thead>
          <tr>
            {["Ticket", "Topic", "Subject", "HUB Order", "Spare Part No.", "Status", "Action", "Routed To", "Score", ""].map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} onClick={() => onOpenTicket(ticket)} className="cursor-pointer">
              <td>
                <div className="min-w-56">
                  <p className="font-bold text-ink">{ticket.title}</p>
                  <p className="text-xs font-semibold text-slate-400">#{ticket.id}</p>
                </div>
              </td>
              <td>{ticket.topic ?? "-"}</td>
              <td>{ticket.subject}</td>
              <td>{ticket.hubOrderNo ?? "-"}</td>
              <td>{ticket.materialNo ?? ticket.materialType}</td>
              <td>
                <Badge value={ticket.status} />
              </td>
              <td className="max-w-80">{ticket.recommendedAction ?? "-"}</td>
              <td>{ticket.assignedTo?.name ?? ticket.routedTeam ?? "-"}</td>
              <td>{ticket.score ? <ScorePill score={ticket.score} /> : "-"}</td>
              <td className="text-right">
                <button
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAssign(ticket.id);
                  }}
                  disabled={loadingTicketId === ticket.id || ticket.status !== "Incoming"}
                >
                  {loadingTicketId === ticket.id ? <Loader2 className="animate-spin" size={14} /> : <Cpu size={14} />}
                  {ticket.status !== "Incoming" ? "Resolved" : loadingTicketId === ticket.id ? "Running" : "Resolve"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
      {tickets.length === 0 && <InlineEmpty message="No tickets match the current filters." />}
    </Surface>
  );
}

function TicketDetailsDrawer({
  ticket,
  assignment,
  resolving,
  onClose,
  onResolve,
  onDelete
}: {
  ticket: Ticket;
  assignment: Assignment | null;
  resolving: boolean;
  onClose: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const owner = ticket.assignedTo?.name ?? ticket.routedTeam ?? "Not routed yet";
  const canResolve = ticket.status === "Incoming";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35">
      <div className="ml-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-line bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-slate-500">Ticket #{ticket.id}</p>
              <h2 className="mt-1 text-2xl font-bold leading-8">{ticket.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge value={ticket.status} />
                <Badge value={ticket.priority} />
                <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {ticket.subject}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onResolve}
                disabled={!canResolve || resolving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resolving ? <Loader2 className="animate-spin" size={16} /> : <Cpu size={16} />}
                {canResolve ? "Resolve" : "Resolved"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                title="Delete ticket"
                aria-label="Delete ticket"
              >
                <Trash2 size={17} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-slate-600 transition hover:bg-slate-100"
                title="Close"
                aria-label="Close ticket details"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <section className="grid gap-3 lg:grid-cols-4">
            <DetailItem label="Owner / team" value={owner} />
            <DetailItem label="Topic" value={ticket.topic} />
            <DetailItem label="Department" value={ticket.department} />
            <DetailItem label="Spare part number" value={ticket.materialNo ?? ticket.materialType} />
            <DetailItem label="Required skill" value={ticket.requiredSkill} />
          </section>

          <section className="rounded-lg border border-line bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Customer message</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {displayValue(ticket.customerMessage)}
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-base font-bold">HUB Order And Spare Part Details</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="HUB order no." value={ticket.hubOrderNo} />
              <DetailItem label="Spare part number" value={ticket.materialNo} />
              <DetailItem label="Division" value={ticket.supplierEntity} />
              <DetailItem label="Shipping type" value={ticket.shippingType} />
              <DetailItem label="Shipping date" value={ticket.shippingDate} />
              <DetailItem label="Auto OBD release" value={formatBoolean(ticket.autoObdRelease)} />
              <DetailItem label="User status block" value={formatBoolean(ticket.hasUserStatusBlock)} />
              <DetailItem label="FAM" value={ticket.itemStatus} />
              <DetailItem label="Delivery / ETA date" value={ticket.deliveryDate} />
              <DetailItem label="Planner" value={ticket.purchaseGroup} />
              <DetailItem label="Kit item" value={formatBoolean(ticket.isKit)} />
              <DetailItem label="Order status" value={ticket.orderStatus} />
              <DetailItem label="CC insisting" value={formatBoolean(ticket.customerCenterInsisting)} />
              <DetailItem label="Planner" value={ticket.plannerName} />
              <DetailItem label="Planner cancellation approval" value={formatBoolean(ticket.plannerApprovedCancellation)} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-base font-bold">PPT Process Requirements</h3>
            <div className="grid gap-2">
              <RequirementRow label="Open ticket and read customer message" passed={Boolean(ticket.title)} />
              <RequirementRow label="Identify Topic and Subject in Additional Fields" passed={Boolean(ticket.topic || ticket.subject)} detail={`${displayValue(ticket.topic)} / ${ticket.subject}`} />
              <RequirementRow label="Copy HUB Order Number" passed={Boolean(ticket.hubOrderNo)} detail={ticket.hubOrderNo ?? undefined} />
              <RequirementRow label="Copy Spare Part Number" passed={Boolean(ticket.materialNo)} detail={ticket.materialNo ?? undefined} />
              <RequirementRow label="Enter Division in HUB Order Cockpit" passed={Boolean(ticket.supplierEntity)} detail={ticket.supplierEntity ?? undefined} />
              <RequirementRow label="Verify Shipping Type" passed={Boolean(ticket.shippingType)} detail={ticket.shippingType ?? undefined} />
              <RequirementRow label="Verify Shipping Date is set" passed={Boolean(ticket.shippingDate)} detail={ticket.shippingDate ?? undefined} />
              <RequirementRow label="Verify Auto OBD Release is Y" passed={ticket.autoObdRelease === true} detail={formatBoolean(ticket.autoObdRelease)} />
              <RequirementRow label="Check User Status blocks" passed={!ticket.hasUserStatusBlock} detail={ticket.hasUserStatusBlock ? "Block found" : "No block"} />
              <RequirementRow label="Check FAM / confirmations" passed={ticket.itemStatus !== null && ticket.itemStatus !== undefined} detail={displayValue(ticket.itemStatus)} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-base font-bold">Resolution Result</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <DetailItem label="Recommended action" value={ticket.recommendedAction} />
              <DetailItem label="Routed team" value={ticket.routedTeam} />
              <DetailItem label="Score" value={ticket.score} />
            </div>
            <div className="mt-3 rounded-lg border border-line bg-white p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Reason</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{displayValue(ticket.reason)}</p>
            </div>
          </section>

          {assignment && (
            <section>
              <h3 className="mb-3 text-base font-bold">Resolution Steps</h3>
              <div className="grid gap-2">
                {assignment.steps.map((step, index) => (
                  <div key={`${step.label}-${index}`} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[36px_1fr_auto] sm:items-center">
                    <div className={`timeline-dot timeline-${step.status} h-9 w-9 text-xs`}>{index + 1}</div>
                    <div>
                      <p className="text-sm font-bold">{step.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{step.detail}</p>
                    </div>
                    <Badge value={step.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ExternalIntake({
  employees,
  result,
  submitting,
  onSubmit
}: {
  employees: Employee[];
  result: IntegrationResult | null;
  submitting: boolean;
  onSubmit: (payload: ExternalTicketPayload) => Promise<void>;
}) {
  const [form, setForm] = React.useState<ExternalTicketPayload>({
    externalTicketId: `EXT-${Date.now().toString().slice(-5)}`,
    sourceSystem: "Order Management",
    title: "Delivery date request from external system",
    department: "Customer Center",
    materialType: "HUB Order",
    requiredSkill: "Delivery Date",
    priority: "High",
    topic: "Delivery date confirmation",
    subject: "Delivery Date",
    customerMessage: "Customer needs confirmed delivery date.",
    hubOrderNo: "450001001",
    materialNo: "MAT-100",
    supplierEntity: "IN01",
    shippingType: "Auto",
    shippingDate: "2026-07-21",
    autoObdRelease: true,
    hasUserStatusBlock: false,
    itemStatus: 100,
    deliveryDate: "31.12.2040",
    purchaseGroup: "",
    isKit: false,
    orderStatus: undefined,
    customerCenterInsisting: false,
    plannerName: "Planner Queue",
    plannerApprovedCancellation: undefined
  });

  const samplePayload = {
    externalTicketId: form.externalTicketId,
    sourceSystem: form.sourceSystem,
    title: form.title,
    department: form.department,
    materialType: form.materialType,
    requiredSkill: form.requiredSkill,
    priority: form.priority,
    topic: form.topic,
    subject: form.subject,
    hubOrderNo: form.hubOrderNo,
    materialNo: form.materialNo,
    supplierEntity: form.supplierEntity,
    itemStatus: form.itemStatus
  };

  function updateField<Key extends keyof ExternalTicketPayload>(key: Key, value: ExternalTicketPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...form,
      externalTicketId: form.externalTicketId.trim(),
      sourceSystem: form.sourceSystem.trim(),
      title: form.title.trim(),
      department: form.department.trim(),
      materialType: form.materialType.trim(),
      requiredSkill: form.requiredSkill.trim(),
      topic: form.topic?.trim()
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Surface
        eyebrow="Integration intake"
        title="Receive Ticket From Another Software"
        action={
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 text-sm font-bold text-cyan-800">
            <PlugZap size={16} />
            POST /integrations/tickets
          </span>
        }
      >
        <form onSubmit={submitForm} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Field label="External ID">
                <input
                  value={form.externalTicketId}
                  onChange={(event) => updateField("externalTicketId", event.target.value)}
                  required
                  minLength={1}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Source software">
                <input
                  value={form.sourceSystem}
                  onChange={(event) => updateField("sourceSystem", event.target.value)}
                  required
                  minLength={2}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-6">
              <Field label="Ticket title">
                <input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  required
                  minLength={2}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="Topic">
                <input
                  value={form.topic ?? ""}
                  onChange={(event) => updateField("topic", event.target.value)}
                  placeholder="Delivery date confirmation"
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="Subject">
                <select
                  value={form.subject}
                  onChange={(event) => {
                    updateField("subject", event.target.value);
                    updateField("requiredSkill", event.target.value);
                  }}
                  required
                  className="field-input"
                >
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field label="HUB order">
                <input
                  value={form.hubOrderNo ?? ""}
                  onChange={(event) => updateField("hubOrderNo", event.target.value)}
                  required
                  minLength={2}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Spare part number">
                <input
                  value={form.materialNo ?? ""}
                  onChange={(event) => updateField("materialNo", event.target.value)}
                  required
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(event) => updateField("priority", event.target.value as Ticket["priority"])}
                  className="field-input"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Division">
                <input
                  value={form.supplierEntity ?? ""}
                  onChange={(event) => updateField("supplierEntity", event.target.value)}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="FAM">
                <input
                  type="number"
                  value={form.itemStatus ?? ""}
                  onChange={(event) => updateField("itemStatus", event.target.value ? Number(event.target.value) : undefined)}
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Delivery / ETA">
                <input
                  value={form.deliveryDate ?? ""}
                  onChange={(event) => updateField("deliveryDate", event.target.value)}
                  placeholder="31.12.2040"
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Order status">
                <input
                  type="number"
                  value={form.orderStatus ?? ""}
                  onChange={(event) => updateField("orderStatus", event.target.value ? Number(event.target.value) : undefined)}
                  placeholder="165"
                  className="field-input"
                />
              </Field>
            </div>
            <div className="lg:col-span-3">
              <Field label="Planner">
                <input
                  value={form.purchaseGroup ?? ""}
                  onChange={(event) => updateField("purchaseGroup", event.target.value)}
                  placeholder="100 / 500"
                  className="field-input"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-end gap-2 lg:col-span-9">
              <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.autoObdRelease ?? false}
                  onChange={(event) => updateField("autoObdRelease", event.target.checked)}
                  className="h-4 w-4 rounded border-line"
                />
                Auto OBD Release Y
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.hasUserStatusBlock ?? false}
                  onChange={(event) => updateField("hasUserStatusBlock", event.target.checked)}
                  className="h-4 w-4 rounded border-line"
                />
                User Status Block
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isKit ?? false}
                  onChange={(event) => updateField("isKit", event.target.checked)}
                  className="h-4 w-4 rounded border-line"
                />
                Kit item
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.customerCenterInsisting ?? false}
                  onChange={(event) => updateField("customerCenterInsisting", event.target.checked)}
                  className="h-4 w-4 rounded border-line"
                />
                CC insisting
              </label>
            </div>
            <div className="lg:col-span-12">
              <Field label="Customer message">
                <AutoGrowTextarea
                  value={form.customerMessage ?? ""}
                  onChange={(value) => updateField("customerMessage", value)}
                  placeholder="Paste the full customer ticket message here"
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="rounded-lg border border-line bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
              <pre className="whitespace-pre-wrap">{JSON.stringify(samplePayload, null, 2)}</pre>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {submitting ? "Receiving" : "Send and assign"}
            </button>
          </div>
        </form>
      </Surface>

      <Surface eyebrow="Return response" title="Assignment Sent Back">
        {result ? (
          <div className="grid gap-3">
            <ResultStrip label="External ID" value={result.externalTicketId ?? "-"} icon={<PlugZap size={17} />} />
            <ResultStrip label="Owner / team" value={result.assignedEmployee?.name ?? result.routedTeam ?? "Manual review"} icon={<UserCheck size={17} />} />
            <ResultStrip label="Status" value={result.status} icon={<CheckCircle2 size={17} />} />
            <ResultStrip label="Action" value={result.recommendedAction ?? "-"} icon={<ListChecks size={17} />} />
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Returned reason</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{result.reason}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-line p-8 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <Send size={20} />
            </div>
            <p className="max-w-sm text-sm leading-6 text-slate-500">
              Send a ticket to see the PPT action, owner/team, score, reason, and stored ticket ID returned to the source system.
            </p>
          </div>
        )}
      </Surface>
    </div>
  );
}

function CreateTicketForm({
  employees,
  saving,
  onSubmit,
  onCancel
}: {
  employees: Employee[];
  saving: boolean;
  onSubmit: (payload: TicketPayload, autoAssign: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const departments = uniqueValues(employees.map((employee) => employee.department));
  const skills = uniqueValues(employees.flatMap((employee) => employee.skills.split(",").map((skill) => skill.trim())));
  const [autoAssign, setAutoAssign] = React.useState(true);
  const [form, setForm] = React.useState<TicketPayload>({
    title: "",
    department: "Customer Center",
    materialType: "HUB Order",
    requiredSkill: "Delivery Date",
    priority: "Medium",
    topic: "",
    subject: "Delivery Date",
    customerMessage: "",
    hubOrderNo: "",
    materialNo: "",
    supplierEntity: "",
    shippingType: "Auto",
    shippingDate: "",
    autoObdRelease: true,
    hasUserStatusBlock: false,
    itemStatus: 100,
    deliveryDate: "",
    purchaseGroup: "",
    isKit: false,
    orderStatus: undefined,
    customerCenterInsisting: false,
    plannerName: "",
    plannerApprovedCancellation: undefined
  });
  const availableDepartmentEmployees = employees.filter(
    (employee) => employee.department === form.department && isEmployeeAvailable(employee)
  );
  const exactSkillMatches = availableDepartmentEmployees.filter((employee) =>
    employee.skills
      .split(",")
      .map((skill) => skill.trim().toLowerCase())
      .includes(form.requiredSkill.toLowerCase())
  );

  function updateField<Key extends keyof TicketPayload>(key: Key, value: TicketPayload[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(
      {
        ...form,
        title: form.title.trim(),
        department: form.department.trim(),
        materialType: form.materialType.trim(),
        requiredSkill: form.requiredSkill.trim(),
        topic: form.topic?.trim()
      },
      autoAssign
    );
  }

  return (
    <form onSubmit={submitForm} className="mb-5 overflow-hidden rounded-lg border border-line bg-white">
      <div className="border-b border-line bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold uppercase text-slate-500">New ticket</p>
        <p className="mt-1 text-base font-bold text-ink">Request details</p>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
              minLength={2}
              placeholder="Laptop request"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Topic">
            <input
              value={form.topic ?? ""}
              onChange={(event) => updateField("topic", event.target.value)}
              placeholder="Delivery date confirmation"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Subject">
            <select
              value={form.subject}
              onChange={(event) => {
                updateField("subject", event.target.value);
                updateField("requiredSkill", event.target.value);
              }}
              required
              className="field-input"
            >
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(event) => updateField("priority", event.target.value as Ticket["priority"])}
              className="field-input"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="HUB order">
            <input
              value={form.hubOrderNo ?? ""}
              onChange={(event) => updateField("hubOrderNo", event.target.value)}
              placeholder="450001001"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Spare part number">
            <input
              value={form.materialNo ?? ""}
              onChange={(event) => updateField("materialNo", event.target.value)}
              placeholder="MAT-100"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Division">
            <input
              value={form.supplierEntity ?? ""}
              onChange={(event) => updateField("supplierEntity", event.target.value)}
              placeholder="IN01"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="FAM">
            <input
              type="number"
              value={form.itemStatus ?? ""}
              onChange={(event) => updateField("itemStatus", event.target.value ? Number(event.target.value) : undefined)}
              placeholder="100 / 115"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Delivery / ETA">
            <input
              value={form.deliveryDate ?? ""}
              onChange={(event) => updateField("deliveryDate", event.target.value)}
              placeholder="31.12.2040"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Planner">
            <input
              value={form.purchaseGroup ?? ""}
              onChange={(event) => updateField("purchaseGroup", event.target.value)}
              placeholder="100 / 500"
              className="field-input"
            />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Order status">
            <input
              type="number"
              value={form.orderStatus ?? ""}
              onChange={(event) => updateField("orderStatus", event.target.value ? Number(event.target.value) : undefined)}
              placeholder="165"
              className="field-input"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:col-span-12">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(event) => setAutoAssign(event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Auto resolve after create
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.autoObdRelease ?? false}
              onChange={(event) => updateField("autoObdRelease", event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Auto OBD Release Y
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.hasUserStatusBlock ?? false}
              onChange={(event) => updateField("hasUserStatusBlock", event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            User Status Block
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isKit ?? false}
              onChange={(event) => updateField("isKit", event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Kit item
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.customerCenterInsisting ?? false}
              onChange={(event) => updateField("customerCenterInsisting", event.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            CC insisting
          </label>
        </div>
        <div className="lg:col-span-12">
          <Field label="Customer message">
            <AutoGrowTextarea
              value={form.customerMessage ?? ""}
              onChange={(value) => updateField("customerMessage", value)}
              placeholder="Paste the full customer ticket message here"
            />
          </Field>
        </div>
      </div>

      <div className="mx-4 mb-4 grid gap-2 rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-950 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-800/70">HUB checks</p>
          <p className="mt-1 font-bold">{form.hubOrderNo ? "Order captured" : "Order needed"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-cyan-800/70">OBD release</p>
          <p className="mt-1 font-bold">{form.autoObdRelease ? "Y" : "Needs check"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-cyan-800/70">Likely route</p>
          <p className="mt-1 font-bold">{form.subject}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          Create
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-bold leading-6 text-ink">{displayValue(value)}</p>
    </div>
  );
}

function RequirementRow({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-white p-3">
      <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div>
        <p className="text-sm font-bold">{label}</p>
        {detail && <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={3}
      className="field-input field-textarea"
    />
  );
}

function EmployeePool({ employees, tickets }: { employees: Employee[]; tickets: Ticket[] }) {
  const departments = [...new Set(employees.map((employee) => employee.department))];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Surface eyebrow="Capacity" title="Employee Pool">
        <div className="grid gap-3">
          {employees.map((employee) => (
            <EmployeeRow key={employee.id} employee={employee} />
          ))}
        </div>
      </Surface>

      <Surface eyebrow="Coverage" title="Department Load">
        <div className="grid gap-3">
          {departments.map((department) => {
            const departmentTickets = tickets.filter((ticket) => ticket.department === department && ticket.status !== "Assigned").length;
            const available = employees.filter((employee) => employee.department === department && isEmployeeAvailable(employee)).length;
            return (
              <div key={department} className="rounded-lg border border-line bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{department}</p>
                  <Badge value={available > 0 ? "Assigned" : "Unassigned"} label={available > 0 ? "Covered" : "Limited"} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{departmentTickets} open tickets, {available} ready employees</p>
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: Employee }) {
  const load = Math.min(100, Math.round((employee.activeTickets / employee.maxCapacity) * 100));
  const skills = employee.skills.split(",").map((skill) => skill.trim());

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold">{employee.name}</p>
            <Badge value={employee.availability ? "Assigned" : "Unassigned"} label={employee.availability ? "Available" : "Unavailable"} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{employee.department}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-64">
          <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
            <span>Workload</span>
            <span>
              {employee.activeTickets}/{employee.maxCapacity}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${load >= 90 ? "bg-rose-500" : load >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${load}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentEngine({ assignment }: { assignment: Assignment | null }) {
  if (!assignment) {
    return <EmptyState title="Assignment Engine" message="Run auto assignment on a ticket to see the matching steps." />;
  }

  return (
    <Surface eyebrow="Decision trace" title="Assignment Engine">
      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="rounded-lg border border-line bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Ticket analyzed</p>
          <p className="mt-1 text-xl font-bold">{assignment.ticket.title}</p>
          <p className="mt-2 text-sm text-slate-500">
            {assignment.ticket.department} request requiring {assignment.ticket.requiredSkill}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-ink p-4 text-white">
          <p className="text-xs font-bold uppercase text-white/60">Engine score</p>
          <p className="mt-1 text-3xl font-bold">{assignment.score}/100</p>
          <p className="mt-2 text-sm text-white/70">{assignment.ticket.recommendedAction ?? assignment.employee?.name ?? "Manual review"}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {assignment.steps.map((step, index) => (
          <div key={step.label} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center">
            <div className={`timeline-dot timeline-${step.status}`}>{index + 1}</div>
            <div>
              <p className="font-bold">{step.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{step.detail}</p>
            </div>
            <Badge value={step.status} />
          </div>
        ))}
      </div>
    </Surface>
  );
}

function AssignmentResults({
  assignment,
  assignments,
  onSelect,
  onDeleteTicket
}: {
  assignment: Assignment | null;
  assignments: Assignment[];
  onSelect: (assignment: Assignment) => void;
  onDeleteTicket: (ticketId: number) => void;
}) {
  if (!assignment) {
    return <EmptyState title="Assignment Results" message="No assignments have been generated yet." />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Surface eyebrow="Outcome" title="Assignment Result Panel">
        <div className="grid gap-3 md:grid-cols-3">
          <ResultStrip label="Ticket" value={assignment.ticket.title} icon={<ClipboardList size={17} />} />
          <ResultStrip label="Owner / team" value={assignment.employee?.name ?? assignment.ticket.routedTeam ?? "Manual review"} icon={<UserCheck size={17} />} />
          <ResultStrip label="Score" value={`${assignment.score}/100`} icon={<Gauge size={17} />} />
        </div>
        <div className="mt-5 rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Recommended action</p>
          <p className="mt-2 text-sm font-bold leading-6 text-ink">{assignment.ticket.recommendedAction ?? "Review manually"}</p>
        </div>
        <div className="mt-5 rounded-lg border border-line bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Resolution reason</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{assignment.reason}</p>
        </div>
      </Surface>

      <Surface eyebrow="History" title="Recent Assignments">
        <div className="grid gap-2">
          {assignments.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-3 transition ${
                item.id === assignment.id ? "border-cyan-300 bg-cyan-50" : "border-line hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                  <p className="font-bold">{item.ticket.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.employee?.name ?? "Unassigned"}</p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <ScorePill score={item.score} />
                  <button
                    type="button"
                    onClick={() => onDeleteTicket(item.ticket.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                    title="Delete ticket"
                    aria-label={`Delete ${item.ticket.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function Surface({
  eyebrow,
  title,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-panel">
      <div className="flex flex-col gap-4 border-b border-line bg-slate-50/70 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ResultStrip({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{icon}</div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-base font-bold leading-6">{value}</p>
    </div>
  );
}

function Badge({ value, label }: { value: string; label?: string }) {
  const classes: Record<string, string> = {
    High: "bg-rose-50 text-rose-700 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
    Low: "bg-slate-100 text-slate-700 ring-slate-200",
    Assigned: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    Incoming: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    Unassigned: "bg-rose-50 text-rose-700 ring-rose-100",
    Routed: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    "Child Ticket Required": "bg-amber-50 text-amber-700 ring-amber-100",
    "Reply Required": "bg-emerald-50 text-emerald-700 ring-emerald-100",
    Escalated: "bg-rose-50 text-rose-700 ring-rose-100",
    "Ready To Cancel": "bg-violet-50 text-violet-700 ring-violet-100",
    "Verification Required": "bg-amber-50 text-amber-700 ring-amber-100",
    "Manual Review": "bg-slate-100 text-slate-700 ring-slate-200",
    passed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    failed: "bg-rose-50 text-rose-700 ring-rose-100"
  };

  return (
    <span className={`inline-flex min-w-[74px] justify-center rounded-md px-2.5 py-1 text-xs font-bold ring-1 ${classes[value] ?? classes.Low}`}>
      {label ?? value}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="inline-flex min-w-[58px] justify-center rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">
      {score}
    </span>
  );
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatBoolean(value?: boolean | null) {
  if (value === null || value === undefined) return "-";
  return value ? "Yes" : "No";
}

function Notice({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
      <AlertTriangle size={17} />
      {message}
    </div>
  );
}

function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table>{children}</table>
    </div>
  );
}

function InlineEmpty({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-line p-8 text-center text-sm font-semibold text-slate-500">
      <Layers3 size={17} />
      {message}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Surface eyebrow="Waiting" title={title}>
      <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-line p-8 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <ArrowRight size={20} />
        </div>
        <p className="max-w-md text-sm leading-6 text-slate-500">{message}</p>
      </div>
    </Surface>
  );
}

function isEmployeeAvailable(employee: Employee) {
  return employee.availability && employee.activeTickets < employee.maxCapacity;
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
