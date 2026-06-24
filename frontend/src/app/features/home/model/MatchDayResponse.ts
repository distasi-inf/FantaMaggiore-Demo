export interface MatchDayResponse {
  id: number;
  description: string;
  date: string;     // LocalDateTime in Java diventa string (ISO format) in TS
  deadline: string;
  status: 'OPEN' | 'LIVE' | 'CALCULATED'; // Usiamo i valori dell'enum MatchDayStatus
  availablePlayerIds: number[];
}