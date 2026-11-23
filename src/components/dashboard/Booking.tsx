"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarberAddress } from "@/components/BarberAddress";
import {
  appointmentDate, appointmentTime, BookingConflict, brasiliaDate,
  cancellationWindowMs, countdown, currency, type Appointment, type Barber,
  type BookingApi, type Service, type Slot,
} from "@/lib/booking";

const steps = ["Serviço", "Barbeiro", "Data e horário"];

export function Booking({ api }: { api: BookingApi }) {
  const [catalog, setCatalog] = useState<{ services: Service[]; barbers: Barber[] } | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [appointmentsError, setAppointmentsError] = useState(false);
  const appointmentsRequest = useRef(0);
  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [now, setNow] = useState(Date.now);
  const [date, setDate] = useState(() => brasiliaDate(Date.now()));
  const [slotRequest, setSlotRequest] = useState(0);
  const [slotResult, setSlotResult] = useState<{ key: string; slots: Slot[] | null } | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const today = brasiliaDate(now);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  const slotKey = JSON.stringify([barber?.id, service?.id, date, slotRequest]);
  const slots = slotResult?.key === slotKey ? slotResult.slots : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setCatalogError(false);
    api.catalog().then((result) => {
      if (active) setCatalog(result);
    }).catch(() => {
      if (active) setCatalogError(true);
    });
    return () => { active = false; };
  }, [api, catalogAttempt]);

  const reloadAppointments = useCallback(async () => {
    const request = ++appointmentsRequest.current;
    setAppointmentsError(false);
    try {
      const rows = await api.appointments();
      if (request === appointmentsRequest.current) setAppointments(rows);
    } catch {
      if (request === appointmentsRequest.current) setAppointmentsError(true);
    }
  }, [api]);

  useEffect(() => { void reloadAppointments(); }, [reloadAppointments]);

  const barberId = barber?.id;
  const serviceId = service?.id;
  useEffect(() => {
    if (step !== 2 || !barberId || !serviceId || !validDate) return;
    let active = true;
    api.slots(barberId, serviceId, date).then((result) => {
      if (active) setSlotResult({ key: slotKey, slots: result });
    }).catch(() => {
      if (active) setSlotResult({ key: slotKey, slots: null });
    });
    return () => { active = false; };
  }, [api, step, barberId, serviceId, date, slotKey, validDate]);

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  async function book() {
    if (!barber || !service || busy || !validDate ||
      !slots?.some((slot) => slot.starts_at === startsAt && slot.available && Date.parse(startsAt) > Date.now())) return;
    clearFeedback();
    setBusy(true);
    try {
      await api.create(barber.id, service.id, startsAt);
      setStep(0);
      setStartsAt("");
      setNotice("Agendamento confirmado.");
      await reloadAppointments();
    } catch (failure) {
      setError(failure instanceof BookingConflict
        ? "Este horário ficou indisponível. Escolha outro horário."
        : "Não foi possível confirmar o agendamento. Confira sua agenda antes de tentar novamente.");
      setStartsAt("");
      await reloadAppointments();
    } finally {
      setSlotRequest((value) => value + 1);
      setBusy(false);
    }
  }

  async function cancel(appointment: Appointment) {
    if (busy) return;
    clearFeedback();
    if (Date.parse(appointment.starts_at) - Date.now() < cancellationWindowMs) {
      setNow(Date.now());
      return;
    }
    setBusy(true);
    try {
      if (await api.cancel(appointment.id)) {
        setAppointments((rows) => rows?.filter(({ id }) => id !== appointment.id) ?? null);
        setNotice("Agendamento cancelado.");
      } else {
        setError("O agendamento já mudou ou passou do prazo de cancelamento.");
      }
      setStartsAt("");
      setSlotRequest((value) => value + 1);
      await reloadAppointments();
    } catch {
      setError("Não foi possível cancelar agora. Confira sua agenda e tente novamente.");
      await reloadAppointments();
    } finally {
      setNow(Date.now());
      setBusy(false);
    }
  }

  const upcoming = appointments?.filter((row) => Date.parse(row.starts_at) > now) ?? [];
  const selectedAvailable = slots?.some((slot) => slot.available && slot.starts_at === startsAt && Date.parse(startsAt) > now);
  const canContinue = step === 0 ? Boolean(service) : Boolean(barber);

  return (
    <div className="booking-layout">
      {(notice || error) && (
        <p className={error ? "booking-feedback error" : "booking-feedback"} role={error ? "alert" : "status"}>
          {error || notice}
        </p>
      )}

      <section className="dashboard-card booking-upcoming" aria-labelledby="booking-upcoming">
        <h2 id="booking-upcoming" className="dashboard-title"><Clock3 aria-hidden="true" /> Próximo agendamento</h2>
        {appointmentsError && (
          <div className="booking-retry">
            <p className="error" role="alert">Não foi possível atualizar sua agenda.</p>
            <button type="button" className="secondary" disabled={busy} onClick={() => void reloadAppointments()}>Tentar novamente</button>
          </div>
        )}
        {!appointments && !appointmentsError && <p role="status" className="muted">Carregando sua agenda…</p>}
        {appointments && !appointmentsError && !upcoming.length && <p className="muted">Você ainda não tem horários marcados.</p>}
        {upcoming.length > 0 && (
          <ul className="booking-appointments">
            {upcoming.map((appointment, index) => {
              const remaining = Date.parse(appointment.starts_at) - now;
              const locked = remaining < cancellationWindowMs;
              const lockId = `cancel-lock-${appointment.id}`;
              return (
                <li key={appointment.id}>
                  <div className="booking-appointment-heading">
                    <div>
                      <h3>{appointment.serviceName} · {appointment.barberName}</h3>
                      <p className="muted"><time dateTime={appointment.starts_at}>{appointmentDate(appointment.starts_at)} às {appointmentTime(appointment.starts_at)}</time></p>
                    </div>
                    {index === 0 && <span className="booking-countdown" aria-label="Tempo restante">Faltam {countdown(remaining)}</span>}
                  </div>
                  <button type="button" className="secondary" disabled={locked || busy}
                    aria-describedby={locked ? lockId : undefined} onClick={() => void cancel(appointment)}>
                    Cancelar agendamento
                  </button>
                  {locked && <p id={lockId} className="muted">O cancelamento exige pelo menos 15 minutos de antecedência.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dashboard-card" aria-labelledby="booking-title">
        <h2 id="booking-title" className="dashboard-title"><CalendarDays aria-hidden="true" /> Marcar horário</h2>
        <ol className="booking-steps" aria-label="Etapas do agendamento">
          {steps.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined}>
              <span className="booking-step-number" aria-hidden="true">{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {catalogError && (
          <div className="booking-retry">
            <p className="error" role="alert">Não foi possível carregar os serviços e barbeiros.</p>
            <button type="button" className="secondary" onClick={() => setCatalogAttempt((value) => value + 1)}>Tentar novamente</button>
          </div>
        )}
        {!catalog && !catalogError && <p className="muted" role="status">Carregando o catálogo…</p>}
        {catalog && step === 0 && (
          <fieldset>
            <legend>Qual serviço você quer?</legend>
            {!catalog.services.length && <p className="muted">Nenhum serviço disponível.</p>}
            <div className="booking-options">
              {catalog.services.map((option) => (
                <label key={option.id} className="booking-option">
                  <input className="sr-only" type="radio" name="service" checked={service?.id === option.id}
                    onChange={() => { setService(option); setStartsAt(""); clearFeedback(); }} />
                  <span className="booking-choice">
                    <strong>{option.nome}</strong>
                    <span>{currency.format(option.preco_reais)}</span>
                    <span className="muted">{option.duracao_minutos} min · +{option.pontos_recompensa} pts</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {catalog && step === 1 && (
          <fieldset>
            <legend>Com quem você quer marcar?</legend>
            {!catalog.barbers.length && <p className="muted">Nenhum barbeiro disponível.</p>}
            <div className="booking-options">
              {catalog.barbers.map((option) => (
                <div key={option.id} className="space-y-1">
                  <label className="booking-option block">
                    <input className="sr-only" type="radio" name="barber" checked={barber?.id === option.id}
                      onChange={() => { setBarber(option); setStartsAt(""); clearFeedback(); }} />
                    <span className="booking-choice">
                      <strong>{option.nome}</strong>
                      <span className="muted">{option.especialidade}</span>
                    </span>
                  </label>
                  {option.endereco && <BarberAddress address={option.endereco} />}
                </div>
              ))}
            </div>
          </fieldset>
        )}
        {step === 2 && (
          <div className="booking-schedule">
            <p className="muted">{service?.nome} · {barber?.nome}</p>
            {barber?.endereco && <p><BarberAddress address={barber.endereco} /></p>}
            <label className="field">
              Data
              <input type="date" min={today} value={date} disabled={busy}
                onChange={(event) => { setDate(event.target.value); setStartsAt(""); clearFeedback(); }} />
            </label>
            <p className="muted">Das 09h às 19h, horário de Brasília.</p>
            {!validDate && <p role="status">Escolha a data de hoje ou uma data futura.</p>}
            {validDate && slots === undefined && <p className="muted" role="status">Consultando horários…</p>}
            {validDate && slots === null && (
              <div className="booking-retry">
                <p className="error" role="alert">Não foi possível consultar os horários.</p>
                <button type="button" className="secondary" onClick={() => setSlotRequest((value) => value + 1)}>Tentar novamente</button>
              </div>
            )}
            {validDate && slots && (
              <fieldset>
                <legend>Horários</legend>
                {!slots.some((slot) => slot.available && Date.parse(slot.starts_at) > now) &&
                  <p className="muted" role="status">Sem horários disponíveis nesta data.</p>}
                <div className="booking-slots">
                  {slots.map((slot) => {
                    const unavailable = !slot.available || Date.parse(slot.starts_at) <= now;
                    const time = appointmentTime(slot.starts_at);
                    return (
                      <button className="secondary" key={slot.starts_at} type="button" disabled={unavailable || busy}
                        aria-pressed={startsAt === slot.starts_at && !unavailable}
                        aria-label={unavailable ? `${time} indisponível` : time}
                        onClick={() => { setStartsAt(slot.starts_at); clearFeedback(); }}>{time}</button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {catalog && (
          <div className="booking-actions">
            {step > 0 && <button type="button" className="secondary" disabled={busy}
              onClick={() => { clearFeedback(); setStep(step - 1); }}>Voltar</button>}
            {step < 2
              ? <button type="button" className="primary" disabled={!canContinue}
                  onClick={() => {
                    clearFeedback();
                    if (step === 1) {
                      setStartsAt("");
                      setSlotRequest((value) => value + 1);
                    }
                    setStep(step + 1);
                  }}>Continuar</button>
              : <button type="button" className="primary" disabled={!selectedAvailable || !validDate || busy}
                  onClick={() => void book()}>Confirmar agendamento</button>}
          </div>
        )}
      </section>
    </div>
  );
}
