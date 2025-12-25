"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";

interface Addon {
  id: string;
  name: string;
  description: string;
  priceMAD: number;
  priceEUR: number;
}

interface DayTripBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripSlug: string;
  tripTitle: string;
  basePriceMAD: number;
  basePriceEUR: number;
  addons: Addon[];
}

declare global {
  interface Window {
    paypal?: any;
  }
}

// ============================================================================
// CALENDAR COMPONENT
// ============================================================================

function Calendar({
  selectedDate,
  onSelectDate,
  minDaysFromNow = 2,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  minDaysFromNow?: number;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + minDaysFromNow);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const formatDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const isBeforeMinDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    return date < minDate;
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", 
                      "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCurrentMonth(prev);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const canGoPrev = new Date(year, month - 1, 1) >= new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="10,2 5,8 10,14" />
          </svg>
        </button>
        <span className="text-sm tracking-wide text-foreground/70">
          {monthNames[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="6,2 11,8 6,14" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="text-center text-[10px] tracking-wider text-foreground/30 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDateStr(year, month, day);
          const isDisabled = isBeforeMinDate(year, month, day);
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={day}
              onClick={() => !isDisabled && onSelectDate(dateStr)}
              disabled={isDisabled}
              className={`
                aspect-square flex items-center justify-center text-sm relative transition-all
                ${isDisabled ? "cursor-not-allowed text-foreground/20" : "cursor-pointer hover:bg-foreground/5"}
                ${isSelected ? "bg-foreground text-white" : ""}
                ${!isDisabled && !isSelected ? "text-foreground/70" : ""}
              `}
            >
              <span className="relative z-10">{day}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-foreground/10">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-foreground" />
          <span className="text-[10px] tracking-wide text-foreground/40 uppercase">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border border-foreground/20 text-foreground/20 flex items-center justify-center text-[8px]">—</div>
          <span className="text-[10px] tracking-wide text-foreground/40 uppercase">Unavailable</span>
        </div>
      </div>

      <p className="text-[10px] text-foreground/40 mt-3">
        Minimum 48 hours notice required
      </p>
    </div>
  );
}

// ============================================================================
// PAYPAL COMPONENT
// ============================================================================

function PayPalButton({
  amount,
  description,
  onSuccess,
  onError,
}: {
  amount: string;
  description: string;
  onSuccess: (transactionId: string) => void;
  onError: (err: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const buttonsInstance = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const renderButton = async () => {
      // Load PayPal SDK if needed
      if (!window.paypal) {
        const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = `https://www.paypal.com/sdk/js?client-id=AWVf28iPmlVmaEyibiwkOtdXAl5UPqL9i8ee9yStaG6qb7hCwNRB2G95SYwbcikLnBox6CGyO-boyAvu&currency=EUR`;
          script.async = true;
          document.body.appendChild(script);
          await new Promise((resolve) => {
            script.onload = resolve;
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      if (!containerRef.current || !window.paypal || !isMounted.current) return;

      try {
        containerRef.current.innerHTML = "";

        buttonsInstance.current = window.paypal.Buttons({
          style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 50 },
          createOrder: (_: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{ description, amount: { value: amount, currency_code: "EUR" } }],
            });
          },
          onApprove: async (_: any, actions: any) => {
            const order = await actions.order.capture();
            if (isMounted.current) onSuccess(order.id);
          },
          onError: (err: any) => {
            if (isMounted.current) onError(err);
          },
        });

        if (containerRef.current && isMounted.current) {
          await buttonsInstance.current.render(containerRef.current);
          setLoading(false);
        }
      } catch (err) {
        console.error("PayPal render error:", err);
        setLoading(false);
      }
    };

    renderButton();

    return () => {
      isMounted.current = false;
      if (buttonsInstance.current?.close) {
        try { buttonsInstance.current.close(); } catch (e) {}
      }
      buttonsInstance.current = null;
    };
  }, [amount, description, onSuccess, onError]);

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border border-foreground/20 border-t-foreground rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="min-h-[50px]" />
    </div>
  );
}

// ============================================================================
// QUANTITY SELECTOR (same style as Riad)
// ============================================================================

function QuantitySelector({
  label,
  value,
  min = 1,
  max = 10,
  onChange,
  note,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  note?: string;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between py-4 border-b border-foreground/10">
        <span className="text-sm text-foreground/70">{label}</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            className="w-8 h-8 flex items-center justify-center border border-foreground/20 text-foreground/50 hover:border-foreground/40 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="6" x2="10" y2="6" />
            </svg>
          </button>
          <span className="w-8 text-center text-foreground">{value}</span>
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            className="w-8 h-8 flex items-center justify-center border border-foreground/20 text-foreground/50 hover:border-foreground/40 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="6" y1="2" x2="6" y2="10" />
              <line x1="2" y1="6" x2="10" y2="6" />
            </svg>
          </button>
        </div>
      </div>
      {note && <p className="text-[10px] text-foreground/40 mt-2">{note}</p>}
    </div>
  );
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

export default function DayTripBookingModal({
  isOpen,
  onClose,
  tripSlug,
  tripTitle,
  basePriceMAD,
  basePriceEUR,
  addons,
}: DayTripBookingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [tripDate, setTripDate] = useState("");
  const [guests, setGuests] = useState(2);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingId, setBookingId] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate totals
  const addonsTotal = selectedAddons.reduce((sum, addonId) => {
    const addon = addons.find((a) => a.id === addonId);
    return sum + (addon ? addon.priceEUR * guests : 0);
  }, 0);

  const addonsTotalMAD = selectedAddons.reduce((sum, addonId) => {
    const addon = addons.find((a) => a.id === addonId);
    return sum + (addon ? addon.priceMAD * guests : 0);
  }, 0);

  const totalEUR = basePriceEUR + addonsTotal;
  const totalMAD = basePriceMAD + addonsTotalMAD;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setBookingComplete(false);
      setTripDate("");
      setGuests(2);
      setSelectedAddons([]);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setPickupLocation("");
      setNotes("");
    }
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handlePaymentSuccess = useCallback(async (transactionId: string) => {
    setIsSubmitting(true);

    try {
      const selectedAddonNames = selectedAddons
        .map((id) => addons.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(", ");

      const response = await fetch("/api/day-trip-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripSlug,
          tripTitle,
          tripDate,
          guests,
          basePriceMAD,
          addons: selectedAddonNames,
          addonsPriceMAD: addonsTotalMAD,
          totalMAD,
          totalEUR,
          guestName,
          guestEmail,
          guestPhone,
          pickupLocation,
          notes,
          paypalTransactionId: transactionId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBookingId(result.bookingId);
        setBookingComplete(true);
        setStep(5);
      } else {
        alert("Booking save failed. Please contact us with your PayPal transaction ID: " + transactionId);
      }
    } catch (error) {
      console.error("Booking error:", error);
      alert("Something went wrong. Please contact us.");
    } finally {
      setIsSubmitting(false);
    }
  }, [tripSlug, tripTitle, tripDate, guests, basePriceMAD, selectedAddons, addons, addonsTotalMAD, totalMAD, totalEUR, guestName, guestEmail, guestPhone, pickupLocation, notes]);

  const handlePaymentError = useCallback((err: any) => {
    console.error("PayPal error:", err);
    alert("Payment failed. Please try again.");
  }, []);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  const canProceedStep1 = tripDate && guests;
  const canProceedStep3 = guestName.trim() && guestEmail.trim() && pickupLocation.trim();

  if (!mounted) return null;
  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div 
        className="relative w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "#f8f5f0" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 hover:opacity-60 transition-opacity"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 border border-foreground rounded-full flex items-center justify-center mx-auto mb-8">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl mb-4">Booking Confirmed</h2>
            <p className="text-muted-foreground mb-2">
              Thank you, {guestName.split(" ")[0]}!
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Confirmation #{bookingId}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Check your email at {guestEmail} for details.
            </p>
            <button
              onClick={onClose}
              className="text-xs tracking-[0.15em] uppercase border-b border-foreground pb-1 hover:opacity-60 transition-opacity"
            >
              Close
            </button>
          </div>
        )}

        {/* Step 1: Date & Guests */}
        {step === 1 && (
          <div className="p-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
              Step 1 of 4
            </p>
            <h2 className="font-serif text-2xl mb-8">{tripTitle}</h2>

            {/* Calendar */}
            <Calendar
              selectedDate={tripDate}
              onSelectDate={setTripDate}
              minDaysFromNow={2}
            />

            {/* Guests selector */}
            <QuantitySelector
              label="Guests"
              value={guests}
              min={1}
              max={2}
              onChange={setGuests}
              note="Price is per car, up to 2 guests"
            />

            {/* Price summary */}
            {canProceedStep1 && (
              <div className="mt-8 pt-6 border-t border-foreground/10">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-foreground/50">{formatDate(tripDate)}</p>
                  </div>
                  <p className="text-2xl font-serif">€{basePriceEUR}</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-60 transition-opacity"
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="5,2 10,7 5,12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add-ons */}
        {step === 2 && (
          <div className="p-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
              Step 2 of 4
            </p>
            <h2 className="font-serif text-2xl mb-8">Enhance Your Day</h2>

            {addons.length > 0 ? (
              <div className="space-y-4">
                {addons.map((addon) => (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`w-full p-5 border text-left transition-colors ${
                      selectedAddons.includes(addon.id)
                        ? "border-foreground"
                        : "border-foreground/20 hover:border-foreground/40"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium mb-1">{addon.name}</p>
                        <p className="text-sm text-muted-foreground">{addon.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">+€{addon.priceEUR}</p>
                        <p className="text-xs text-muted-foreground">per person</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No add-ons available for this tour.</p>
            )}

            {/* Price summary */}
            <div className="mt-8 pt-6 border-t border-foreground/10">
              <div className="flex justify-between items-center">
                <span className="text-foreground/50 text-sm">Total</span>
                <p className="text-2xl font-serif">€{totalEUR}</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase hover:opacity-60 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="9,2 4,7 9,12" />
                </svg>
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase hover:opacity-60 transition-opacity"
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="5,2 10,7 5,12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="p-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
              Step 3 of 4
            </p>
            <h2 className="font-serif text-2xl mb-8">Your Details</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full border-b border-foreground/20 pb-3 focus:outline-none focus:border-foreground bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full border-b border-foreground/20 pb-3 focus:outline-none focus:border-foreground bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-2">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full border-b border-foreground/20 pb-3 focus:outline-none focus:border-foreground bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-2">
                  Pickup Location (hotel/riad name)
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full border-b border-foreground/20 pb-3 focus:outline-none focus:border-foreground bg-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-foreground/40 mb-2">
                  Special Requests (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border-b border-foreground/20 pb-3 focus:outline-none focus:border-foreground bg-transparent resize-none"
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase hover:opacity-60 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="9,2 4,7 9,12" />
                </svg>
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!canProceedStep3}
                className="flex items-center gap-2 text-xs tracking-[0.15em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-60 transition-opacity"
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="5,2 10,7 5,12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="p-10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">
              Step 4 of 4
            </p>
            <h2 className="font-serif text-2xl mb-8">Payment</h2>

            {/* Summary */}
            <div className="bg-foreground/[0.03] p-6 mb-6">
              <p className="font-serif text-lg mb-2">{tripTitle}</p>
              <p className="text-sm text-foreground/50 mb-4">{formatDate(tripDate)}</p>
              
              <div className="space-y-2 pt-4 border-t border-foreground/10">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/50">Day trip ({guests} guest{guests > 1 ? "s" : ""})</span>
                  <span>€{basePriceEUR}</span>
                </div>
                {selectedAddons.map((addonId) => {
                  const addon = addons.find((a) => a.id === addonId);
                  if (!addon) return null;
                  return (
                    <div key={addonId} className="flex justify-between text-sm">
                      <span className="text-foreground/50">{addon.name} × {guests}</span>
                      <span>€{addon.priceEUR * guests}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-base pt-3 border-t border-foreground/10 mt-3">
                  <span className="font-medium">Total</span>
                  <span className="font-serif text-xl">€{totalEUR}</span>
                </div>
              </div>
            </div>

            {/* PayPal Button */}
            <PayPalButton
              amount={totalEUR.toFixed(2)}
              description={`${tripTitle} - ${formatDate(tripDate)}`}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />

            {isSubmitting && (
              <p className="text-center text-sm text-foreground/50 mt-4">
                Processing...
              </p>
            )}

            <button
              onClick={() => setStep(3)}
              className="mt-6 flex items-center gap-2 text-xs tracking-[0.15em] uppercase hover:opacity-60 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="9,2 4,7 9,12" />
              </svg>
              Back
            </button>

            {/* Contact link */}
            <p className="text-center mt-6 text-[11px] text-foreground/30">
              <a href="/contact" className="hover:text-foreground/50 transition-colors">Send us a note</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
