# Slow World Shared Components

**Version:** 1.0.0  
**Last Updated:** December 25, 2025

Stable, tested components shared across all Slow World projects. **Do not modify unless intentionally updating.**

---

## Repository Purpose

This is the **single source of truth** for shared UI components. When you need to update a component:
1. Update it here
2. Test it
3. Copy to projects that need the update

**Never edit these components directly in project repos.** Always edit here first.

---

## Components

### BookingModal

Universal booking modal that handles all booking types across all projects.

**File:** `components/BookingModal.tsx`

#### Use Cases

| Project | Use Case | Config |
|---------|----------|--------|
| Riad di Siena | Room bookings | `selectCheckout: true`, `maxGuests: 2`, `hasCityTax: true` |
| Riad di Siena | Kasbah experience | `selectCheckout: false`, `maxNights: 5`, `maxUnits: 3` |
| Riad di Siena | Desert Camp tents | `selectCheckout: false`, `maxNights: 3`, `maxUnits: 4` |
| Slow Morocco | Journey bookings | `selectCheckout: false`, `maxNights: 14`, `unitLabel: "person"` |
| Dancing with Lions | Workshop bookings | `selectCheckout: false`, `maxNights: 3` |

#### Installation

```bash
# Copy to your project
cp slow-world-shared/components/BookingModal.tsx your-project/components/
```

#### Dependencies

The component expects these to exist in your project:
- Tailwind CSS with these colors defined:
  - `foreground` - text color
  - `bg-[#f8f5f0]` - modal background (warm sand)
- `font-serif` class for headings
- `/api/ical` endpoint (optional, for availability checking)
- `/api/bookings` endpoint (or custom via `apiEndpoint` config)

#### Basic Usage

```tsx
import BookingModal from "@/components/BookingModal";

<BookingModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  item={{
    id: "room-123",
    name: "Deluxe Suite",
    priceEUR: "150",
    iCalURL: "https://...", // optional
  }}
  config={{
    maxGuests: 2,
    hasCityTax: true,
    selectCheckout: true,
  }}
  formatPrice={(amount) => `€${amount}`}
  paypalClientId="your-client-id"
/>
```

#### Config Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxGuests` | number | 0 | Max guests selector (0 = hidden) |
| `maxNights` | number | 5 | Nights selector max (when `selectCheckout: false`) |
| `maxUnits` | number | 0 | Units selector (rooms/tents/persons) |
| `unitLabel` | string | "room" | Label for units |
| `hasCityTax` | boolean | false | Add city tax calculation |
| `cityTaxPerNight` | number | 2.5 | City tax per guest per night |
| `selectCheckout` | boolean | true | `true` = date range, `false` = arrival + nights |
| `propertyName` | string | - | For booking records |
| `paypalContainerId` | string | "paypal-booking-container" | Unique PayPal container |
| `apiEndpoint` | string | "/api/bookings" | Custom API endpoint |

#### Examples by Project Type

**Hotel Rooms (with iCal + city tax):**
```tsx
config={{
  maxGuests: 2,
  hasCityTax: true,
  cityTaxPerNight: 2.5,
  selectCheckout: true,  // Pick check-in then check-out
}}
```

**Multi-day Experience (Kasbah style):**
```tsx
config={{
  maxNights: 5,
  maxUnits: 3,
  unitLabel: "room",
  selectCheckout: false,  // Pick arrival, then select nights
  propertyName: "The Kasbah",
}}
```

**Per-Person Journey (Slow Morocco style):**
```tsx
config={{
  maxNights: 14,
  maxUnits: 8,
  unitLabel: "person",
  selectCheckout: false,
  propertyName: "Slow Morocco",
}}
```

**Simple Workshop (Dancing with Lions):**
```tsx
config={{
  maxNights: 3,
  selectCheckout: false,
}}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Dec 25, 2025 | Initial release - unified BookingModal |

---

## Projects Using These Components

- Riad di Siena (`riaddisiena.com`)
- Slow Morocco (`slowmorocco.com`)
- Slow Namibia (`slownamibia.com`)
- Slow Türkiye (`slowturkiye.com`)
- Slow Tunisia (`slowtunisia.com`)
- Slow Mauritius (`slowmauritius.com`)
- Dancing with Lions (`dancingwiththelions.com`)

---

## Adding New Components

When adding a new shared component:

1. Create it in `components/`
2. Document it in this README
3. Test thoroughly
4. Update version number
5. Copy to projects as needed

**Naming convention:** PascalCase, descriptive, no abbreviations.
- ✅ `BookingModal.tsx`
- ✅ `CurrencySelector.tsx`
- ❌ `BkModal.tsx`
- ❌ `modal.tsx`
