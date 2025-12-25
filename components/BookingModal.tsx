"use client";

import { useState, useEffect } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface BookingItem {
  id: string;
  name: string;
  priceEUR: string;
  iCalURL?: string;
}

export interface BookingConfig {
  // Quantity selectors
  maxGuests?: number;        // Show guests selector (e.g., 2 for rooms)
  maxNights?: number;        // Show nights selector (e.g., 5 for experiences)
  maxUnits?: number;         // Show units selector (rooms/tents/etc.)
  unitLabel?: string;        // Label: "room", "tent", "person", etc.
  
  // Pricing
  hasCityTax?: boolean;      // Add city tax to total
  cityTaxPerNight?: number;  // Default 2.5 EUR
  
  // Behavior
  selectCheckout?: boolean;  // true = pick checkout date, false = pick nights
  
  // Branding
  propertyName?: string;     // For booking record
  brandColor?: string;       // Accent color (default: foreground)
  
  // Technical
  paypalContainerId?: string;
  apiEndpoint?: string;      // Default: /api/bookings
}

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BookingItem;
  config: BookingConfig;
  formatPrice: (amount: number) => string;
  paypalClientId: string;
  onBookingComplete?: (booking: BookingData) => void;
}

export interface BookingData {
  itemId: string;
  itemName: string;
  propertyName?: string;
  checkIn: string;
  checkOut?: string;
  nights: number;
  guests?: number;
  units?: number;
  totalEUR: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  message?: string;
  paypalTransactionId: string;
}

interface BookedDate {
  start: Date;
  end: Date;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingModal({
  isOpen,
  onClose,
  item,
  config,
  formatPrice,
  paypalClientId,
  onBookingComplete,
}: BookingModalProps) {
  // Defaults
  const {
    maxGuests = 0,
    maxNights = 5,
    maxUnits = 0,
    unitLabel = "room",
    hasCityTax = false,
    cityTaxPerNight = 2.5,
    selectCheckout = true,
    propertyName,
    paypalContainerId = "paypal-booking-container",
    apiEndpoint = "/api/bookings",
  } = config;

  // State
  const [step, setStep] = useState(1);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [nights, setNights] = useState(1);
  const [guests, setGuests] = useState(maxGuests || 2);
  const [units, setUnits] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [selectingCheckOut, setSelectingCheckOut] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCheckIn(null);
      setCheckOut(null);
      setNights(1);
      setGuests(maxGuests || 2);
      setUnits(1);
      setSelectingCheckOut(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", message: "" });
      setCurrentMonth(new Date());
      if (item.iCalURL) fetchAvailability();
    }
  }, [isOpen, item.iCalURL, maxGuests]);

  // Fetch iCal availability
  const fetchAvailability = async () => {
    if (!item.iCalURL) return;
    try {
      const response = await fetch(`/api/ical?url=${encodeURIComponent(item.iCalURL)}`);
      const data = await response.json();
      if (data.bookedDates) {
        setBookedDates(data.bookedDates.map((d: { start: string; end: string }) => ({
          start: new Date(d.start),
          end: new Date(d.end),
        })));
      }
    } catch (error) {
      console.error("Failed to fetch availability:", error);
    }
  };

  // Load PayPal
  useEffect(() => {
    if (step === 3 && !paypalLoaded) {
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        setPaypalLoaded(true);
        setTimeout(renderPayPal, 100);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=EUR`;
      script.async = true;
      script.onload = () => {
        setPaypalLoaded(true);
        renderPayPal();
      };
      document.body.appendChild(script);
    } else if (step === 3 && paypalLoaded) {
      setTimeout(renderPayPal, 100);
    }
  }, [step, paypalLoaded, paypalClientId]);

  const renderPayPal = () => {
    const container = document.getElementById(paypalContainerId);
    if (!container || !window.paypal) return;
    container.innerHTML = "";
    window.paypal.Buttons({
      style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 50 },
      createOrder: (_: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            description: `${item.name} - ${calculateNights()} nights`,
            amount: { value: calculateGrandTotal().toFixed(2), currency_code: "EUR" },
          }],
        });
      },
      onApprove: async (_: any, actions: any) => {
        const order = await actions.order.capture();
        await handlePaymentSuccess(order.id);
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        alert("Payment failed. Please try again.");
      },
    }).render(`#${paypalContainerId}`);
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    setIsSubmitting(true);
    
    const bookingData: BookingData = {
      itemId: item.id,
      itemName: item.name,
      propertyName,
      checkIn: checkIn?.toISOString().split("T")[0] || "",
      checkOut: selectCheckout ? checkOut?.toISOString().split("T")[0] : undefined,
      nights: calculateNights(),
      guests: maxGuests > 0 ? guests : undefined,
      units: maxUnits > 0 ? units : undefined,
      totalEUR: calculateGrandTotal().toFixed(2),
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || undefined,
      message: formData.message || undefined,
      paypalTransactionId: transactionId,
    };

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      const result = await response.json();
      if (result.success) {
        setStep(4);
        onBookingComplete?.(bookingData);
      }
    } catch (error) {
      console.error("Booking error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date helpers
  const isDateBooked = (date: Date): boolean => {
    return bookedDates.some(booking => {
      const d = new Date(date);
      d.setHours(12, 0, 0, 0);
      const start = new Date(booking.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(booking.end);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    });
  };

  const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (date: Date) => {
    if (isDateInPast(date)) return;

    if (selectCheckout) {
      // Room mode: select check-in, then check-out
      if (!checkIn || (checkIn && checkOut)) {
        if (isDateBooked(date)) return;
        setCheckIn(date);
        setCheckOut(null);
        setSelectingCheckOut(true);
      } else if (selectingCheckOut && date > checkIn) {
        // Allow checkout on booked date (checkout is morning, before next guest)
        const hasBookedInRange = bookedDates.some(booking => {
          const start = new Date(booking.start);
          return start > checkIn && start < date;
        });
        if (!hasBookedInRange) {
          setCheckOut(date);
          setSelectingCheckOut(false);
        }
      }
    } else {
      // Experience mode: just select arrival date
      if (isDateBooked(date)) return;
      setCheckIn(date);
    }
  };

  const calculateNights = () => {
    if (selectCheckout) {
      if (!checkIn || !checkOut) return 0;
      return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    }
    return nights;
  };

  const calculateSubtotal = () => {
    const pricePerUnit = parseFloat(item.priceEUR || "0");
    const numNights = calculateNights();
    if (maxUnits > 0) {
      return pricePerUnit * units * numNights;
    }
    return pricePerUnit * numNights;
  };

  const calculateCityTax = () => {
    if (!hasCityTax || maxGuests === 0) return 0;
    return cityTaxPerNight * guests * calculateNights();
  };

  const calculateGrandTotal = () => calculateSubtotal() + calculateCityTax();

  const formatDateShort = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const formatDateLong = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const getDateClassName = (date: Date) => {
    const booked = isDateBooked(date);
    const past = isDateInPast(date);
    const isCheckInDate = checkIn && date.toDateString() === checkIn.toDateString();
    const isCheckOutDate = checkOut && date.toDateString() === checkOut.toDateString();
    const inRange = selectCheckout && checkIn && checkOut && date > checkIn && date < checkOut;

    if (isCheckInDate || isCheckOutDate) return "bg-foreground text-[#f8f5f0] font-medium";
    if (inRange) return "bg-foreground/10";
    if (booked) return "bg-[#e8e4de] text-foreground/50";
    if (past) return "text-foreground/20 cursor-not-allowed";
    return "text-foreground/70 hover:bg-foreground/5";
  };

  const isDateDisabled = (date: Date) => {
    if (isDateInPast(date)) return true;
    if (selectCheckout && selectingCheckOut && checkIn && date > checkIn) {
      return false;
    }
    return isDateBooked(date);
  };

  // Validation
  const canProceed1 = selectCheckout 
    ? (checkIn && checkOut)
    : (checkIn && nights >= 1 && (maxUnits === 0 || units >= 1));
  const canProceed2 = formData.firstName && formData.lastName && formData.email;

  if (!isOpen) return null;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f8f5f0] w-full max-w-md mx-4 shadow-2xl">
        
        {/* Progress bar */}
        {step < 4 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-foreground/10">
            <div className="h-full bg-foreground/80 transition-all duration-500 ease-out" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        )}

        {/* Close button */}
        <button onClick={onClose} className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground/80 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
          </svg>
        </button>

        {/* ==================== STEP 4: SUCCESS ==================== */}
        {step === 4 && (
          <div className="px-10 py-16 text-center">
            <div className="w-14 h-14 border border-foreground/80 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="4,12 10,18 20,6" />
              </svg>
            </div>
            <h2 className="font-serif text-2xl mb-3">Booking Confirmed</h2>
            <p className="text-foreground/50 text-sm mb-10 leading-relaxed">
              Thank you. A confirmation has been sent to<br />{formData.email}
            </p>
            <button onClick={onClose} className="text-xs tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground transition-colors">
              Close
            </button>
          </div>
        )}

        {/* ==================== STEP 1: DATES ==================== */}
        {step === 1 && (
          <div className="px-8 py-8">
            <p className="text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">Step 1 of 3</p>
            <h2 className="font-serif text-xl text-foreground/90 mb-6">{item.name}</h2>

            {/* Calendar */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground/80 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9,2 4,7 9,12" /></svg>
                </button>
                <span className="text-sm text-foreground/70">{currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground/80 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="5,2 10,7 5,12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] tracking-wide mb-2">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-foreground/30 py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {getDaysInMonth(currentMonth).map((date, i) => {
                  if (!date) return <div key={i} className="aspect-square" />;
                  return (
                    <button
                      key={i}
                      onClick={() => handleDateClick(date)}
                      disabled={isDateDisabled(date)}
                      className={`aspect-square text-xs flex items-center justify-center transition-all duration-200 rounded-sm ${getDateClassName(date)}`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected dates display */}
            {checkIn && (
              <div className="text-sm text-foreground/60 mb-5 pb-4 border-b border-foreground/10">
                {selectCheckout ? (
                  <>
                    <span className="text-foreground/90">{formatDateShort(checkIn)}</span>
                    {checkOut ? (
                      <>
                        <span className="mx-2">→</span>
                        <span className="text-foreground/90">{formatDateShort(checkOut)}</span>
                        <span className="ml-3 text-foreground/40">·</span>
                        <span className="ml-3">{calculateNights()} nights</span>
                      </>
                    ) : (
                      <span className="ml-3 text-foreground/40">Select checkout</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-foreground/40">Arrival:</span>
                    <span className="ml-2 text-foreground/90">{formatDateLong(checkIn)}</span>
                  </>
                )}
              </div>
            )}

            {/* Nights selector (for experience mode) */}
            {!selectCheckout && checkIn && (
              <div className="mb-5">
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-3">Nights</label>
                <div className="flex gap-2">
                  {Array.from({ length: maxNights }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      onClick={() => setNights(num)}
                      className={`flex-1 py-3 text-sm transition-all duration-200 rounded-sm ${nights === num ? "bg-foreground text-[#f8f5f0]" : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Units selector (for experience mode) */}
            {maxUnits > 0 && checkIn && (
              <div className="mb-5">
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-3 capitalize">{unitLabel}s</label>
                <div className="flex gap-2">
                  {Array.from({ length: maxUnits }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      onClick={() => setUnits(num)}
                      className={`flex-1 py-3 text-sm transition-all duration-200 rounded-sm ${units === num ? "bg-foreground text-[#f8f5f0]" : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-foreground/40 mt-3">{formatPrice(parseFloat(item.priceEUR))} per {unitLabel} per night</p>
              </div>
            )}

            {/* Price summary (rooms with checkout) */}
            {selectCheckout && checkIn && checkOut && (
              <div className="mb-5 pt-4 border-t border-foreground/10">
                {/* Guests selector */}
                {maxGuests > 0 && (
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-foreground/50">Guests</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                        disabled={guests === 1}
                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${guests === 1 ? "text-foreground/20 cursor-not-allowed" : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="6" x2="10" y2="6" /></svg>
                      </button>
                      <span className="text-sm text-foreground/80 w-4 text-center">{guests}</span>
                      <button 
                        onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                        disabled={guests === maxGuests}
                        className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${guests === maxGuests ? "text-foreground/20 cursor-not-allowed" : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5"}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="6" x2="10" y2="6" /><line x1="6" y1="2" x2="6" y2="10" /></svg>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between text-foreground/50 mb-2 text-sm">
                  <span>{formatPrice(parseFloat(item.priceEUR))} × {calculateNights()} nights</span>
                  <span>{formatPrice(calculateSubtotal())}</span>
                </div>
                {hasCityTax && maxGuests > 0 && (
                  <div className="flex justify-between text-foreground/50 mb-3 text-sm">
                    <span>City tax ({guests} × {calculateNights()} × €{cityTaxPerNight.toFixed(2)})</span>
                    <span>€{calculateCityTax().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-foreground/10">
                  <span className="text-foreground/70">Total</span>
                  <span className="font-serif text-lg text-foreground/90">{formatPrice(calculateGrandTotal())}</span>
                </div>
              </div>
            )}

            {/* Price summary (experience mode) */}
            {!selectCheckout && checkIn && (
              <div className="mb-5 pt-4 border-t border-foreground/10">
                <div className="flex justify-between pt-3">
                  <span className="text-foreground/70">Total</span>
                  <span className="font-serif text-lg text-foreground/90">{formatPrice(calculateGrandTotal())}</span>
                </div>
              </div>
            )}

            {/* Continue button */}
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed1}
                className={`flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-all duration-200 ${canProceed1 ? "text-foreground/80 hover:text-foreground" : "text-foreground/20 cursor-not-allowed"}`}
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="5,2 10,7 5,12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: DETAILS ==================== */}
        {step === 2 && (
          <div className="px-10 py-12">
            <p className="text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">Step 2 of 3</p>
            <h2 className="font-serif text-2xl text-foreground/90 mb-10">Your Details</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <input type="text" placeholder="First name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full bg-transparent border-b border-foreground/20 pb-3 text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors" />
                <input type="text" placeholder="Last name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full bg-transparent border-b border-foreground/20 pb-3 text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors" />
              </div>
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-transparent border-b border-foreground/20 pb-3 text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors" />
              <input type="tel" placeholder="Phone (optional)" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-transparent border-b border-foreground/20 pb-3 text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors" />
              <textarea placeholder="Special requests (optional)" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={2} className="w-full bg-transparent border-b border-foreground/20 pb-3 text-foreground/90 placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 transition-colors resize-none" />
            </div>
            <div className="mt-12 pt-6 border-t border-foreground/10 flex justify-between items-center">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground/80 transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9,2 4,7 9,12" /></svg>
                Back
              </button>
              <button onClick={() => setStep(3)} disabled={!canProceed2} className={`flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase transition-all duration-200 ${canProceed2 ? "text-foreground/80 hover:text-foreground" : "text-foreground/20 cursor-not-allowed"}`}>
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="5,2 10,7 5,12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: PAYMENT ==================== */}
        {step === 3 && (
          <div className="px-10 py-12">
            <p className="text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-1">Step 3 of 3</p>
            <h2 className="font-serif text-2xl text-foreground/90 mb-10">Payment</h2>
            <div className="mb-10 pb-6 border-b border-foreground/10 text-sm">
              <div className="flex justify-between text-foreground/50 mb-1">
                <span>{item.name}</span>
                <span>{calculateNights()} night{calculateNights() > 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between text-foreground/50 mb-1">
                <span>
                  {selectCheckout 
                    ? `${formatDateShort(checkIn)} → ${formatDateShort(checkOut)}`
                    : formatDateLong(checkIn)
                  }
                </span>
                <span>
                  {maxGuests > 0 && `${guests} guest${guests > 1 ? "s" : ""}`}
                  {maxUnits > 0 && `${units} ${unitLabel}${units > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t border-foreground/10">
                <span className="text-foreground/70">Total</span>
                <span className="font-serif text-xl text-foreground/90">{formatPrice(calculateGrandTotal())}</span>
              </div>
            </div>
            <div id={paypalContainerId} className="min-h-[50px]">
              {!paypalLoaded && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                </div>
              )}
            </div>
            {isSubmitting && <p className="text-center text-sm text-foreground/40 mt-4">Processing...</p>}
            <button onClick={() => setStep(2)} className="mt-8 flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground/80 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9,2 4,7 9,12" /></svg>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
