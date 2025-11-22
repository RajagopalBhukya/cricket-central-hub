import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Booking {
  id: string;
  groundId: string;
  groundName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  totalAmount: number;
  status: 'active' | 'completed' | 'cancelled';
}

interface BookingState {
  bookings: Booking[];
  selectedGround: string | null;
  selectedDate: string | null;
  selectedTimeSlot: { start: string; end: string } | null;
}

const initialState: BookingState = {
  bookings: [],
  selectedGround: null,
  selectedDate: null,
  selectedTimeSlot: null,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setSelectedGround: (state, action: PayloadAction<string>) => {
      state.selectedGround = action.payload;
    },
    setSelectedDate: (state, action: PayloadAction<string>) => {
      state.selectedDate = action.payload;
    },
    setSelectedTimeSlot: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.selectedTimeSlot = action.payload;
    },
    addBooking: (state, action: PayloadAction<Booking>) => {
      state.bookings.push(action.payload);
    },
    clearSelection: (state) => {
      state.selectedGround = null;
      state.selectedDate = null;
      state.selectedTimeSlot = null;
    },
  },
});

export const {
  setSelectedGround,
  setSelectedDate,
  setSelectedTimeSlot,
  addBooking,
  clearSelection,
} = bookingSlice.actions;

export default bookingSlice.reducer;
