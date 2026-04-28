export interface TripChatParticipant {
  id: string;
  fullName: string;
  role: string;
}

export interface TripChatMessage {
  id: string;
  reservationId: string;
  tripId: string;
  routeOfferId: string | null;
  senderUserId: string;
  receiverUserId: string;
  message: string;
  createdAt: string;
  sender: TripChatParticipant | null;
  receiver: TripChatParticipant | null;
}

export interface ReservationChatResponse {
  reservationId: string;
  tripId: string;
  participants: {
    driverUserId: string;
    passengerUserId: string;
  };
  messages: TripChatMessage[];
}
