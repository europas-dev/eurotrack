export type Language = 'en' | 'de';
export const translations: Record<Language, any> = {
  de: {
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    freeBeds: "FREIE BETTEN",
    yearlyTotal: "JAHRESSUMME",
    monthlyTotal: "MONATSSUMME",
    searchPlaceholder: "Firma, Hotel oder Mitarbeiter suchen...",
    sidebar: { addCompany: "Firma hinzufügen", newCompanyName: "Neue Firma", selectYear: "JAHR WÄHLEN" },
    hotelCard: { addEntry: "Eintrag hinzufügen", hotelName: "Hotel Name", stayDurations: "Buchungsdauer", totalMonthlyCost: "Gesamt" },
    common: { save: "Speichern", cancel: "Abbrechen" }
  },
  en: {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    freeBeds: "FREE BEDS",
    yearlyTotal: "YEARLY TOTAL",
    monthlyTotal: "MONTHLY TOTAL",
    searchPlaceholder: "Search company, hotel or employee...",
    sidebar: { addCompany: "Add Company", newCompanyName: "New Company", selectYear: "SELECT A YEAR" },
    hotelCard: { addEntry: "Add Hotel", hotelName: "Hotel Name", stayDurations: "Booking Durations", totalMonthlyCost: "Total" },
    common: { save: "Save", cancel: "Cancel" }
  }
};
