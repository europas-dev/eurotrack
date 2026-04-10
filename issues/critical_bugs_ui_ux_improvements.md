# Issue: Critical Bugs and UI/UX Improvements

## RoomCard Component

### Issue 1: Image not loading
**Description:** Users report that images for RoomCard do not load properly in certain conditions.
**References:** `RoomCard.js` lines 34-56
**Implementation Requirements:** Ensure images are fetched correctly using the correct source link.

### Issue 2: Accessibility Enhancements
**Description:** Improve keyboard navigation and screen reader support.
**References:** `RoomCard.js` lines 15-34
**Implementation Requirements:** Add aria-labels and modify tabindex accordingly.

## DurationCard Component

### Issue 3: Incorrect Duration Display
**Description:** DurationCard sometimes displays negative duration when invalid dates are selected.
**References:** `DurationCard.js` lines 23-45
**Implementation Requirements:** Validate input dates and adjust display logic accordingly.

### Issue 4: Styling Issues on Mobile
**Description:** The card's layout is not responsive on mobile devices.
**References:** `DurationCard.css` lines 45-70
**Implementation Requirements:** Use media queries to enhance mobile layout.

## HotelRow Component

### Issue 5: Missing Booking Button
**Description:** The booking button does not display if the hotel is fully booked.
**References:** `HotelRow.js` lines 10-30
**Implementation Requirements:** Ensure conditional rendering for the button is accurately handled.

### Issue 6: User Feedback Integration
**Description:** Add user rating and review features to the HotelRow.
**References:** `HotelRow.js` lines 50-90
**Implementation Requirements:** Integrate a ratings system and create a modal for user reviews.
