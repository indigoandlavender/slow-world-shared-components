"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

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
  maxGuests?: number;
  maxNights?: number;
  maxUnits?: number;
  unitLabel?: string;
  hasCityTax?: boolean;
  cityTaxPerNight?: number;
  selectCheckout?: boolean;
  propertyName?: string;
  paypalContainerId?: string;
}

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BookingItem;
  config: BookingConfig;
  formatPrice: (amount: number) => string;
  paypalClientId: string;
  onBookingComplete?: (data: any) => void;
}

// ============================================================================
// PAYPAL COMPONENT - Isolated with proper cleanup
// ============================================================================

function PayPalButton({
  amount,
  description,
  clientId,
  onSuccess,
  onError,
}: {
  amount: string;
  description: string;
  clientId: string;
  onSuccess: (transactionId: string) => void;
  onError: (err: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const buttonsInstance = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let timeoutId: NodeJS.Timeout;

    const renderButton = async () => {
      if (!containerRef.current || !window.paypal || !isMounted.current) return;

      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        buttonsInstance.current = window.paypal.Buttons({
          style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 50 },
          createOrder: (_: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{ description, amount: { value: amount, currency_code: "EUR" } }],
            });
          },
          onApprove: async (_: any, actions: any) => {
            if (!isMounted.current) return;
            const order = await actions.order.capture();
            onSuccess(order.id);
          },
          onError: (err: any) => {
            if (!isMounted.current) return;
            onError(err);
          },
        });

        if (containerRef.current && isMounted.current) {
          await buttonsInstance.current.render(containerRef.current);
          if (isMounted.current) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("PayPal render error:", err);
        if (isMounted.current) {
          setError(true);
          setLoading(false);
        }
      }
    };

    const initPayPal = () => {
      if (window.paypal) {
        renderButton();
      } else {
        const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR`;
          script.async = true;
          script.onload = () => {
            if (isMounted.current) renderButton();
          };
          script.onerror = () => {
            if (isMounted.current) {
              setError(true);
              setLoading(false);
            }
          };
          document.head.appendChild(script);
        } else {
          const checkInterval = setInterval(() => {
            if (window.paypal) {
              clearInterval(checkInterval);
              if (isMounted.current) renderButton();
            }
          }, 100);
          
          timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            if (isMounted.current && !window.paypal) {
              setError(true);
              setLoading(false);
            }
          }, 10000);
        }
      }
    };

    requestAnimationFrame(initPayPal);

    return () => {
      isMounted.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      
      if (buttonsInstance.current && typeof buttonsInstance.current.close === "function") {
        try {
          buttonsInstance.current.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      buttonsInstance.current = null;
    };
  }, [amount, description, clientId, onSuccess, onError]);

  if (error) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-foreground/50">Unable to load payment. Please refresh and try again.</p>
      </div>
    );
  }

  return (
    <div>
      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}

// ============================================================================
// QUANTITY SELECTOR COMPONENT
// ============================================================================

function QuantitySelector({
  label,
  value,
  min = 1,
  max = 10,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  return (
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
  );
}

// ============================================================================
// MAIN COMPONENT
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isOpen || !item || !item.id) return null;

  return createPortal(
    <BookingModalContent
      onClose={onClose}
      item={item}
      config={config}
      formatPrice={formatPrice}
      paypalClientId={paypalClientId}
      onBookingComplete={onBookingComplete}
    />,
    document.body
  );
}

function BookingModalContent({
  onClose,
  item,
  config,
  formatPrice,
  paypalClientId,
  onBookingComplete,
}: Omit<BookingModalProps, "isOpen">) {
  const {
    maxGuests = 2,
    maxNights = 30,
    maxUnits = 1,
    unitLabel = "room",
    hasCityTax = false,
    cityTaxPerNight = 2.5,
    selectCheckout = true,
  } = config;

  const [step, setStep] = useState(1);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [nights, setNights] = useState(1);
  const [guests, setGuests] = useState(1);
  const [units, setUnits] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate nights from dates if selectCheckout is true
  const calculatedNights = selectCheckout && checkIn && checkOut
    ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
    : nights;

  const pricePerNight = parseFloat(item.priceEUR) || 0;
  const subtotal = pricePerNight * calculatedNights * units;
  const cityTax = hasCityTax ? cityTaxPerNight * guests * calculatedNights : 0;
  const total = subtotal + cityTax;

  const today = new Date().toISOString().split("T")[0];

  const handlePaymentSuccess = useCallback(async (transactionId: string) => {
    setIsSubmitting(true);
    const bookingData = {
      itemId: item.id,
      itemName: item.name,
      checkIn,
      checkOut: selectCheckout ? checkOut : "",
      nights: calculatedNights,
      guests,
      units,
      totalEUR: total.toFixed(2),
      firstName,
      lastName,
      email,
      phone,
      message,
      paypalTransactionId: transactionId,
    };

    try {
      const response = await fetch("/api/bookings", {
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
      alert("Failed to save booking. Please contact us.");
    } finally {
      setIsSubmitting(false);
    }
  }, [item, checkIn, checkOut, selectCheckout, calculatedNights, guests, units, total, firstName, lastName, email, phone, message, onBookingComplete]);

  const handlePaymentError = useCallback((err: any) => {
    console.error("PayPal error:", err);
    alert("Payment failed. Please try again.");
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Reset form when item changes
  useEffect(() => {
    setStep(1);
    setCheckIn("");
    setCheckOut("");
    setNights(1);
    setGuests(1);
    setUnits(1);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setMessage("");
  }, [item.id]);

  const canProceedStep1 = selectCheckout 
    ? checkIn && checkOut && calculatedNights >= 1
    : checkIn && nights >= 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#f8f5f0] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-foreground/40 hover:text-foreground/80 transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="14" y2="14" />
            <line x1="14" y1="2" x2="2" y2="14" />
          </svg>
        </button>

        <div className="p-10">
          {/* Header */}
          <div className="mb-8">
            <h2 className="font-serif text-2xl text-foreground/90 mb-1">{item.name}</h2>
            <p className="text-sm text-foreground/50">{formatPrice(pricePerNight)} per {unitLabel} per night</p>
          </div>

          {/* Step 1: Dates & Quantity */}
          {step === 1 && (
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-6">Step 1 of 3 — Select dates</p>

              {/* Check-in */}
              <div className="mb-4">
                <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && e.target.value >= checkOut) setCheckOut("");
                  }}
                  className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                />
              </div>

              {/* Check-out or Nights */}
              {selectCheckout ? (
                <div className="mb-6">
                  <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                  />
                </div>
              ) : (
                <QuantitySelector
                  label="Nights"
                  value={nights}
                  min={1}
                  max={maxNights}
                  onChange={setNights}
                />
              )}

              {/* Units (if more than 1 allowed) */}
              {maxUnits > 1 && (
                <QuantitySelector
                  label={`${unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}s`}
                  value={units}
                  min={1}
                  max={maxUnits}
                  onChange={setUnits}
                />
              )}

              {/* Guests */}
              {maxGuests > 1 && (
                <QuantitySelector
                  label="Guests"
                  value={guests}
                  min={1}
                  max={maxGuests}
                  onChange={setGuests}
                />
              )}

              {/* Price summary */}
              {canProceedStep1 && (
                <div className="mt-8 pt-6 border-t border-foreground/10">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground/50">
                      {formatPrice(pricePerNight)} × {calculatedNights} night{calculatedNights > 1 ? "s" : ""}
                      {units > 1 && ` × ${units} ${unitLabel}s`}
                    </span>
                    <span className="text-foreground/70">{formatPrice(subtotal)}</span>
                  </div>
                  {hasCityTax && (
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-foreground/50">City tax</span>
                      <span className="text-foreground/70">€{cityTax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base pt-3 border-t border-foreground/10">
                    <span className="text-foreground/70">Total</span>
                    <span className="font-medium text-foreground">{formatPrice(total)}</span>
                  </div>
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="w-full mt-8 py-4 bg-foreground text-[#f8f5f0] text-sm tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-foreground/90 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Guest Details */}
          {step === 2 && (
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-6">Step 2 of 3 — Your details</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Phone <span className="normal-case text-foreground/30">(optional)</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs tracking-wider uppercase text-foreground/40 mb-2">Special requests <span className="normal-case text-foreground/30">(optional)</span></label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full py-3 bg-transparent border-b border-foreground/20 focus:border-foreground/40 focus:outline-none text-foreground transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border border-foreground/20 text-foreground/70 text-sm tracking-wider uppercase hover:border-foreground/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="9,2 4,7 9,12" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!firstName || !lastName || !email}
                  className="flex-1 py-4 bg-foreground text-[#f8f5f0] text-sm tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="5,2 10,7 5,12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-6">Step 3 of 3 — Payment</p>

              {/* Booking summary */}
              <div className="bg-foreground/[0.03] p-6 mb-6">
                <p className="font-serif text-lg text-foreground/90 mb-1">{item.name}</p>
                <p className="text-sm text-foreground/50 mb-4">
                  {checkIn} {selectCheckout && checkOut ? `→ ${checkOut}` : ""} · {calculatedNights} night{calculatedNights > 1 ? "s" : ""} · {guests} guest{guests > 1 ? "s" : ""}
                  {units > 1 && ` · ${units} ${unitLabel}s`}
                </p>
                <div className="flex justify-between pt-4 border-t border-foreground/10">
                  <span className="text-foreground/70">Total</span>
                  <span className="font-medium text-foreground">{formatPrice(total)}</span>
                </div>
              </div>

              <PayPalButton
                amount={total.toFixed(2)}
                description={`${item.name} - ${calculatedNights} nights`}
                clientId={paypalClientId}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />

              {isSubmitting && (
                <p className="text-center text-sm text-foreground/50 mt-4">Processing payment...</p>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full mt-6 py-4 border border-foreground/20 text-foreground/70 text-sm tracking-wider uppercase hover:border-foreground/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="9,2 4,7 9,12" />
                </svg>
                Back
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 border border-foreground/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="6,14 12,20 22,8" />
                </svg>
              </div>
              <h3 className="font-serif text-2xl text-foreground/90 mb-2">Booking Confirmed</h3>
              <p className="text-sm text-foreground/50 mb-8">
                Thank you! A confirmation has been sent to {email}
              </p>
              <button
                onClick={onClose}
                className="text-xs tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
