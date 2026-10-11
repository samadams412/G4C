export interface Category {
  category_id: number;
  name: string;
}

export interface EventSummary {
  event_id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  status: string;
  categories: Category[];
}

export interface Venue {
  venue_id: number;
  name: string;
  capacity: number;
  address: string | null;
  city: string | null;
}

export interface EventDetail {
  event_id: number;
  organizer_id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  status: string;
  venue: Venue;
  categories: Category[];
}

export interface Ticket {
  ticket_id: string;
  event_id: number;
  price: string;
  status: string;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${process.env.API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API request to ${path} failed with ${res.status}`);
  }
  return res.json();
}

export async function getEvents(): Promise<EventSummary[]> {
  const result = await apiFetch<{ data: EventSummary[] }>("/events?status=Published&pageSize=100");
  return result.data;
}

export async function getCategories(): Promise<Category[]> {
  const result = await apiFetch<{ data: Category[] }>("/categories");
  return result.data;
}

export async function getEvent(id: number): Promise<EventDetail | null> {
  const res = await fetch(`${process.env.API_URL}/events/${id}`, { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`API request to /events/${id} failed with ${res.status}`);
  }
  return res.json();
}

export async function getEventTickets(id: number): Promise<Ticket[]> {
  const result = await apiFetch<{ data: Ticket[] }>(`/tickets?event_id=${id}&pageSize=100`);
  return result.data;
}
