import { nextSeed } from "./random";
import { A, B, DOWN, LEFT, RIGHT, UP, maxTicks, type Difficulty, type Game, type GameState } from "./types";

const stations = [
  { x: 40, y: 38, label: "LAVAR", color: "#55c8cf" },
  { x: 120, y: 38, label: "CORTE", color: "#f49bad" },
  { x: 200, y: 38, label: "TOALHA", color: "#f9dc85" },
];
const chairs = [{ x: 48, y: 112 }, { x: 120, y: 112 }, { x: 192, y: 112 }];
const settings = {
  EASY: { seats: 1, wait: 900, rhythm: 112, perfect: 20, yellow: 34, goal: 2 },
  MEDIUM: { seats: 2, wait: 710, rhythm: 80, perfect: 15, yellow: 28, goal: 3 },
  HARD: { seats: 3, wait: 490, rhythm: 58, perfect: 11, yellow: 22, goal: 4 },
};
type Customer = { requests: number[]; deadline: number; color: string };
type ValleyState = GameState & {
  seed: number;
  difficulty: Difficulty;
  x: number; y: number;
  previous: number; carrying: number;
  customers: (Customer | null)[];
  nextArrival: number;
  service: { chair: number; started: number } | null;
  served: number;
  message: string; messageUntil: number;
};

function nextCustomer(state: ValleyState): Customer {
  state.seed = nextSeed(state.seed);
  const first = state.seed % 3;
  const requests = [first];
  if (state.difficulty !== "EASY") requests.push((first + 1 + ((state.seed >>> 9) % 2)) % 3);
  return {
    requests,
    deadline: state.ticks + settings[state.difficulty].wait,
    color: ["#ba7857", "#e2a375", "#805046"][(state.seed >>> 12) % 3],
  };
}

function closeTo(state: ValleyState, point: { x: number; y: number }) {
  return Math.abs(state.x - point.x) < 17 && Math.abs(state.y - point.y) < 17;
}

function setMessage(state: ValleyState, message: string) {
  state.message = message;
  state.messageUntil = state.ticks + 85;
}

function meter(state: ValleyState) {
  if (!state.service) return 0;
  const period = settings[state.difficulty].rhythm;
  const elapsed = (state.ticks - state.service.started) % period;
  return Math.floor(Math.min(elapsed, period - elapsed) * 200 / period);
}

export const valley: Game<ValleyState> = {
  create(seed, difficulty) {
    const state: ValleyState = {
      score: 0, ticks: 0, status: "playing", seed, difficulty,
      x: 120, y: 76, carrying: -1, previous: 0, nextArrival: 100,
      service: null, served: 0, customers: Array(settings[difficulty].seats).fill(null),
      message: "", messageUntil: 0,
    };
    state.customers[0] = nextCustomer(state);
    return state;
  },
  step(state, input) {
    if (state.status !== "playing") return;
    state.ticks++;
    const config = settings[state.difficulty];
    const pressed = input & ~state.previous;
    const released = state.previous & ~input;
    state.previous = input;
    for (let i = 0; i < state.customers.length; i++) {
      const customer = state.customers[i];
      if (customer && customer.deadline <= state.ticks) {
        state.customers[i] = null;
        if (state.service?.chair === i) state.service = null;
        setMessage(state, "CLIENTE FOI EMBORA");
      }
    }
    if (state.ticks >= state.nextArrival) {
      const seat = state.customers.indexOf(null);
      if (seat !== -1) {
        state.customers[seat] = nextCustomer(state);
        state.nextArrival = state.ticks + 110 + ((state.seed >>> 6) % 45);
      }
    }

    if (state.service) {
      if (released & A) {
        const index = state.service.chair;
        const customer = state.customers[index];
        const distance = Math.abs(50 - meter(state));
        if (customer && distance <= config.yellow) {
          const perfect = distance <= config.perfect;
          customer.requests.shift();
          state.score = Math.min(450, state.score + (perfect ? 40 : 20));
          if (!customer.requests.length) {
            state.served++;
            state.customers[index] = null;
          } else {
            customer.deadline = Math.max(customer.deadline, state.ticks + Math.floor(config.wait / 2));
          }
          setMessage(state, perfect ? "PERFEITO! +40" : "BOM TRABALHO! +20");
        } else {
          state.customers[index] = null;
          setMessage(state, "FORA DO RITMO");
        }
        state.carrying = -1;
        state.service = null;
      }
    } else {
      const horizontal = Number(Boolean(input & RIGHT)) - Number(Boolean(input & LEFT));
      const vertical = Number(Boolean(input & DOWN)) - Number(Boolean(input & UP));
      state.x = Math.min(222, Math.max(18, state.x + horizontal * 1.35));
      state.y = Math.min(138, Math.max(27, state.y + vertical * 1.35));
      if (pressed & B) {
        const station = stations.findIndex((point) => closeTo(state, point));
        if (station !== -1) state.carrying = station;
      }
      if (pressed & A) {
        const seat = chairs.findIndex((point, index) => Boolean(state.customers[index]) && closeTo(state, point));
        if (seat !== -1) {
          if (state.customers[seat]?.requests[0] === state.carrying) {
            state.service = { chair: seat, started: state.ticks };
          } else setMessage(state, "PEGUE O ITEM DO PEDIDO");
        }
      }
    }
    if (state.ticks >= maxTicks) state.status = state.served >= config.goal ? "won" : "lost";
  },
  draw(ctx, state) {
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const text = (label: string, x: number, y: number, color = "#fff1cf") => {
      ctx.fillStyle = color; ctx.font = "bold 8px monospace"; ctx.textAlign = "left"; ctx.fillText(label, x, y);
    };
    rect(0, 0, 240, 160, "#40394d");
    rect(10, 20, 220, 124, "#a96859");
    for (let y = 54; y < 144; y += 10) rect(10, y, 220, 1, "#8e534e");
    rect(76, 63, 88, 29, "#5c9a89");
    for (let x = 84; x < 160; x += 13) rect(x, 70, 3, 16, "#8bc2a0");
    stations.forEach((station) => {
      rect(station.x - 25, 27, 50, 20, "#57475e");
      rect(station.x - 25, 27, 50, 4, station.color);
      text(station.label, station.x - 19, 40);
    });
    rect(15, 52, 14, 16, "#553c54"); rect(19, 53, 3, 8, "#92bc75"); rect(24, 52, 2, 10, "#aad982");
    rect(211, 52, 14, 16, "#553c54"); rect(215, 53, 3, 8, "#92bc75"); rect(220, 52, 2, 10, "#aad982");
    state.customers.forEach((customer, index) => {
      const { x, y } = chairs[index];
      rect(x - 14, y - 9, 28, 23, "#59465a");
      rect(x - 10, y - 6, 20, 16, "#d88585");
      if (!customer) return;
      rect(x - 5, y - 9, 10, 9, customer.color);
      rect(x - 5, y - 1, 10, 8, "#4a435a");
      rect(x - 28, y - 31, 56, 14, "#fff1cf");
      text(stations[customer.requests[0]].label, x - 20, y - 21, "#47354a");
      rect(x - 21, y - 16, 42, 2, "#724c51");
      rect(x - 21, y - 16, Math.ceil(42 * (customer.deadline - state.ticks) / settings[state.difficulty].wait), 2, "#9addaa");
    });
    rect(state.x - 5, state.y - 10, 10, 6, "#ffd29b");
    rect(state.x - 5, state.y - 4, 10, 8, "#384454");
    if (state.carrying !== -1) rect(state.x + 4, state.y - 3, 5, 5, stations[state.carrying].color);
    text(`CLIENTES ${state.served}/${settings[state.difficulty].goal}`, 11, 12);
    text("BARBEARIA DA VILA", 140, 12, "#f2c282");

    if (state.service) {
      const { perfect, yellow } = settings[state.difficulty];
      rect(67, 132, 106, 15, "#40394d");
      rect(70, 135, 100, 8, "#c1747c");
      rect(120 - yellow, 135, yellow * 2, 8, "#e6b468");
      rect(120 - perfect, 135, perfect * 2, 8, "#89d09d");
      rect(70 + meter(state), 133, 2, 12, "#fff4df");
      text("SOLTE A NO VERDE", 76, 156);
    } else {
      text(state.messageUntil > state.ticks ? state.message : "B  PEGAR ITEM    A  ATENDER", 12, 155);
    }
  },
};
