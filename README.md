# Slow World Shared Components

**Version:** 1.2.0  
**Last Updated:** December 25, 2025

Reusable components for the Slow World ecosystem. Drop into any Next.js project.

---

## Components

### BookingModal

Full-featured booking modal with calendar grid, guest selection, and PayPal integration.

**Features:**
- Custom calendar grid (no browser date picker)
- Check-in/Check-out selection with range highlighting
- iCal integration for availability
- +/- quantity selectors for guests, nights, units
- Extra guest fees from Google Sheets
- City tax calculation
- Per-person pricing mode (for journeys)
- PayPal payment with hydration fix
- Portal rendering (no z-index issues)
- Warm sand background (#f8f5f0)

**Usage:**
```tsx
import BookingModal from "@/components/BookingModal";

<BookingModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  item={{
    id: "room-1",
    name: "Jasmine Suite",
    priceEUR: "150",
    icalUrl: "https://...", // optional
  }}
  config={{
    maxNights: 14,
    maxUnits: 1,
    maxGuestsPerUnit: 4,
    baseGuestsPerUnit: 2,
    unitLabel: "room",
    hasCityTax: true,
    cityTaxPerNight: 2.5,
    extraPersonFee: 60, // from Google Sheets
    selectCheckout: true,
    propertyName: "Riad di Siena",
    paypalContainerId: "paypal-room-1",
  }}
  formatPrice={(amount) => `€${amount}`}
  paypalClientId="YOUR_PAYPAL_CLIENT_ID"
/>
```

**Config Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| maxNights | number | 30 | Maximum nights allowed |
| maxUnits | number | 1 | Max rooms/tents (hides selector if 1) |
| maxGuestsPerUnit | number | 2 | Max guests per unit |
| baseGuestsPerUnit | number | 2 | Guests included in base price |
| unitLabel | string | "room" | Label for units |
| hasCityTax | boolean | false | Enable city tax |
| cityTaxPerNight | number | 2.5 | City tax per guest per night |
| extraPersonFee | number | 0 | Fee per extra guest per night |
| selectCheckout | boolean | true | Show checkout date picker |
| isPerPersonPricing | boolean | false | Price × guests (not × nights) |
| propertyName | string | "" | For booking confirmation |
| paypalContainerId | string | required | Unique ID for PayPal button |

**Per-Person Pricing Mode:**
For journeys where price is per person, not per night:
```tsx
config={{
  maxNights: 1,        // Hide nights selector
  maxUnits: 1,         // Hide units selector
  maxGuestsPerUnit: 6,
  baseGuestsPerUnit: 1,
  isPerPersonPricing: true, // Price × guests
  selectCheckout: false,
}}
```

---

### DayTripBookingModal

Simplified modal for day trips with add-ons.

**Features:**
- Custom calendar grid with 48-hour minimum notice
- +/- guest selector (max 2)
- Add-on selection with per-person pricing
- 4-step flow: Date → Add-ons → Details → Payment
- PayPal integration with hydration fix

**Usage:**
```tsx
import DayTripBookingModal from "@/components/DayTripBookingModal";

<DayTripBookingModal
  isOpen={isBookingOpen}
  onClose={() => setIsBookingOpen(false)}
  tripSlug="ourika-valley"
  tripTitle="Ourika Valley"
  basePriceMAD={1860}
  basePriceEUR={186}
  addons={[
    {
      id: "lunch",
      name: "Traditional Lunch",
      description: "Tagine on a terrace",
      priceMAD: 230,
      priceEUR: 23,
    },
  ]}
/>
```

---

## Design System

### Colors
```css
--background: #f8f5f0;     /* Warm sand (modal bg) */
--foreground: #1a1a1a;     /* Near black */
--muted-foreground: #666;  /* Gray text */
```

### Typography
- Step indicators: `text-[10px] tracking-[0.3em] uppercase`
- Modal titles: `font-serif text-2xl`
- Labels: `text-[10px] tracking-[0.2em] uppercase text-foreground/40`
- Body: `text-sm text-foreground/70`

### Calendar Grid
- 7-column grid
- Day headers: Su Mo Tu We Th Fr Sa
- Selected: `bg-foreground text-white`
- Range: `bg-foreground/10`
- Disabled: `text-foreground/20`
- Unavailable: `bg-foreground/10` overlay

### Quantity Selectors
+/- buttons with centered value:
```
[ - ]  2  [ + ]
```
- Button: `w-8 h-8 border border-foreground/20`
- Hover: `border-foreground/40`
- Disabled: `opacity-30`

### Navigation
Chevron arrows for Continue/Back:
```tsx
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
  <polyline points="5,2 10,7 5,12" /> {/* Right */}
  <polyline points="9,2 4,7 9,12" />  {/* Left */}
</svg>
```

---

## PayPal Hydration Fix

**The Problem:** React hydration error when closing modal with PayPal button.

**The Solution:**
1. Keep modal mounted (don't use `selectedItem &&` conditional)
2. Clear selected item with `setTimeout(..., 300)` delay
3. Use `buttonsInstance.current.close()` in cleanup

**Page-level pattern:**
```tsx
// Keep modal always mounted
<BookingModal
  isOpen={isModalOpen && selectedRoom !== null}
  onClose={() => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedRoom(null), 300);
  }}
  item={selectedRoom ? { ... } : { id: "", name: "", priceEUR: "0" }}
/>
```

---

## Installation

1. Copy components to your project's `/components/` folder
2. Ensure dependencies: `lucide-react`
3. Set up PayPal client ID in environment
4. Configure Tailwind with the color variables

---

## Changelog

### v1.2.0 (Dec 25, 2025)
- Added DayTripBookingModal
- Unified +/- quantity selectors
- Per-person pricing mode for journeys
- Calendar grid styling refinements

### v1.1.0 (Dec 25, 2025)
- Custom calendar grid (replaces browser date picker)
- iCal integration for availability
- Extra guest fees from Google Sheets
- City tax from Settings sheet

### v1.0.0 (Dec 24, 2025)
- Initial BookingModal with PayPal hydration fix
- Portal rendering
- Step-by-step flow
