/**
 * Field descriptions for the entry forms. They are plain data so a server page can hand them to the
 * client-side dialog; the server action re-validates every submission with its Zod schema.
 */
import { DEFAULT_FUEL_PRICE } from "@/lib/validators/vehicles";

export type Option = { value: string; label: string };

export type Field = {
  name: string;
  label: string;
  /**
   * ledger: a checkbox that, when ticked, also records the cost as an expense in Finance.
   * scores: game scores typed as "21-17, 19-21".
   */
  type: "text" | "number" | "date" | "datetime" | "select" | "checkbox" | "textarea" | "ledger" | "scores";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: Option[];
  /** "now" pre-fills date and date-time fields with the moment the form is opened. */
  defaultValue?: string | number | boolean;
  step?: string;
  min?: number;
  /** Take half the row on wider screens. */
  half?: boolean;
};

const opts = (values: readonly string[]): Option[] =>
  values.map((value) => {
    const text = value.replace(/_/g, " ");
    return { value, label: text.charAt(0).toUpperCase() + text.slice(1) };
  });

export const toOptions = (rows: { id: string; name: string }[]): Option[] => rows.map((r) => ({ value: r.id, label: r.name }));

// Ticked by default: money spent on a fill-up, service, parking, court or payment is an expense unless you say otherwise.
const ledger = (hint = "Adds a matching expense to your transactions."): Field => ({ name: "record_expense", label: "Also record this as an expense in Finance", type: "ledger", defaultValue: true, hint });

// ---------------------------------------------------------------- finance

export const transactionFields = (categories: Option[], accounts: Option[]): Field[] => [
  { name: "type", label: "Type", type: "select", required: true, half: true, defaultValue: "expense", options: opts(["expense", "income"]) },
  { name: "amount", label: "Amount", type: "number", required: true, half: true, step: "0.01", min: 0.01 },
  { name: "title", label: "What was it for", type: "text", required: true, placeholder: "Groceries at Jaya Grocer" },
  { name: "occurred_at", label: "When", type: "datetime", required: true, defaultValue: "now" },
  { name: "category_id", label: "Category", type: "select", half: true, options: categories },
  { name: "account_id", label: "Account", type: "select", half: true, options: accounts },
  { name: "note", label: "Note", type: "textarea" },
];

export const accountFields: Field[] = [
  { name: "name", label: "Account name", type: "text", required: true, placeholder: "Maybank Savings" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "bank", options: opts(["bank", "cash", "ewallet", "credit_card", "savings", "other"]) },
  { name: "opening_balance", label: "Opening balance", type: "number", half: true, step: "0.01", defaultValue: 0 },
];

export const categoryFields: Field[] = [
  { name: "name", label: "Category name", type: "text", required: true, placeholder: "Groceries" },
  { name: "kind", label: "Used for", type: "select", required: true, half: true, defaultValue: "expense", options: opts(["expense", "income"]) },
  {
    name: "bucket",
    label: "Group",
    type: "select",
    required: true,
    half: true,
    defaultValue: "general",
    options: opts(["general", "housing", "utilities", "food", "transport", "vehicle", "health", "fitness", "sports", "hardware", "prototyping", "digital_overhead", "cloud_subscription", "insurance", "debt", "other"]),
  },
];

export const monthlyGoalFields = (incomeTarget: number, expenseLimit: number): Field[] => [
  { name: "income_target", label: "Income target", type: "number", required: true, half: true, step: "0.01", defaultValue: incomeTarget },
  { name: "expense_limit", label: "Spending limit", type: "number", required: true, half: true, step: "0.01", defaultValue: expenseLimit },
];

export const subscriptionFields = (categories: Option[], accounts: Option[]): Field[] => [
  { name: "name", label: "Subscription", type: "text", required: true, placeholder: "Netflix" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "saas", options: opts(["saas", "cloud_infra", "ai_api", "domain_hosting", "software_license", "streaming", "telco_internet", "membership", "other"]) },
  { name: "vendor", label: "Billed by", type: "text", half: true },
  { name: "amount", label: "Amount per bill", type: "number", required: true, half: true, step: "0.01" },
  { name: "billing_cycle", label: "Billed", type: "select", required: true, half: true, defaultValue: "monthly", options: opts(["weekly", "monthly", "quarterly", "yearly"]) },
  { name: "next_billing_on", label: "Next bill date", type: "date", half: true, hint: "The charge is recorded on this date, then it moves on." },
  { name: "account_id", label: "Paid from", type: "select", half: true, options: accounts },
  { name: "category_id", label: "Category", type: "select", options: categories },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true, hint: "Untick when the subscription is cancelled." },
];

export const liabilityFields = (accounts: Option[]): Field[] => [
  { name: "name", label: "Debt", type: "text", required: true, placeholder: "Car loan" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "loan", options: opts(["loan", "hardware_installment", "credit_card", "bnpl", "other"]) },
  { name: "lender", label: "Lender", type: "text", half: true },
  { name: "principal", label: "Amount borrowed", type: "number", required: true, half: true, step: "0.01" },
  { name: "opening_paid", label: "Already repaid", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "monthly_payment", label: "Monthly payment", type: "number", required: true, half: true, step: "0.01" },
  { name: "due_day", label: "Due day of month", type: "number", half: true, step: "1", min: 1, hint: "The payment is recorded on this day each month." },
  { name: "account_id", label: "Paid from", type: "select", half: true, options: accounts },
  { name: "status", label: "Status", type: "select", required: true, half: true, defaultValue: "active", options: opts(["active", "paid_off", "defaulted"]) },
];

export const liabilityPaymentFields = (liabilities: Option[]): Field[] => [
  { name: "liability_id", label: "Debt", type: "select", required: true, options: liabilities },
  { name: "amount", label: "Amount paid", type: "number", required: true, half: true, step: "0.01", min: 0.01 },
  { name: "paid_on", label: "Paid on", type: "date", required: true, half: true, defaultValue: "now" },
  ledger(),
];

export const assetFields: Field[] = [
  { name: "name", label: "Asset", type: "text", required: true, placeholder: "ASB" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "other", options: opts(["cash", "stock", "fund", "crypto", "gold", "property", "vehicle", "device", "other"]) },
  { name: "code", label: "Ticker or code", type: "text", half: true },
  { name: "amount_invested", label: "Amount paid", type: "number", required: true, half: true, step: "0.01", defaultValue: 0 },
  { name: "purchased_on", label: "Bought on", type: "date", half: true },
];

export const valuationFields = (assets: Option[]): Field[] => [
  { name: "asset_id", label: "Asset", type: "select", required: true, options: assets },
  { name: "value", label: "Value now", type: "number", required: true, half: true, step: "0.01" },
  { name: "valued_on", label: "Valued on", type: "date", required: true, half: true, defaultValue: "now" },
];

export const goalFields: Field[] = [
  { name: "name", label: "Goal", type: "text", required: true, placeholder: "Emergency fund" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "savings", options: opts(["savings", "emergency_fund", "purchase", "debt_payoff"]) },
  { name: "target_date", label: "Target date", type: "date", half: true },
  { name: "target_amount", label: "Target amount", type: "number", required: true, half: true, step: "0.01" },
  { name: "current_amount", label: "Saved so far", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "is_completed", label: "Goal reached", type: "checkbox" },
];

// ---------------------------------------------------------------- vehicles

export const vehicleFields: Field[] = [
  { name: "name", label: "Nickname", type: "text", required: true, placeholder: "Myvi" },
  { name: "make", label: "Make", type: "text", half: true, placeholder: "Perodua" },
  { name: "model", label: "Model", type: "text", half: true, placeholder: "Myvi 1.5 AV" },
  { name: "year", label: "Year", type: "number", half: true, step: "1", min: 1950 },
  { name: "plate_number", label: "Plate number", type: "text", half: true },
  { name: "fuel_type", label: "Fuel", type: "select", required: true, half: true, defaultValue: "ron95", options: [{ value: "ron95", label: "RON95" }, { value: "ron97", label: "RON97" }, ...opts(["diesel", "hybrid"]), { value: "ev", label: "Electric" }, ...opts(["other"])] },
  { name: "tank_capacity_l", label: "Tank size (litres)", type: "number", half: true, step: "0.1", min: 0.1 },
  { name: "initial_odometer_km", label: "Odometer today (km)", type: "number", step: "1", defaultValue: 0, hint: "Distance is counted from this reading." },
];

export const fuelFields = (vehicles: Option[]): Field[] => [
  { name: "vehicle_id", label: "Vehicle", type: "select", required: true, half: true, options: vehicles, defaultValue: vehicles[0]?.value },
  { name: "filled_at", label: "When", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "odometer_km", label: "Odometer (km)", type: "number", required: true, half: true, step: "1" },
  { name: "total_cost", label: "Amount paid", type: "number", half: true, step: "0.01", min: 0.01, placeholder: "50.00", hint: "Or leave empty and enter the litres." },
  { name: "price_per_liter", label: "Price per litre", type: "number", required: true, half: true, step: "0.001", defaultValue: DEFAULT_FUEL_PRICE },
  { name: "liters", label: "Litres", type: "number", half: true, step: "0.001", min: 0.001, hint: "Leave empty to work it out from the amount paid." },
  { name: "station", label: "Station", type: "text", half: true },
  { name: "is_full_tank", label: "Filled to full", type: "checkbox", defaultValue: true, hint: "Fuel economy is measured between two full tanks." },
  ledger(),
];

export const maintenanceFields = (vehicles: Option[]): Field[] => [
  { name: "vehicle_id", label: "Vehicle", type: "select", required: true, half: true, options: vehicles, defaultValue: vehicles[0]?.value },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "service", options: opts(["service", "oil_change", "tyres", "brakes", "battery", "repair", "inspection", "road_tax", "insurance", "accessories", "other"]) },
  { name: "description", label: "What was done", type: "text" },
  { name: "performed_on", label: "Date", type: "date", required: true, half: true, defaultValue: "now" },
  { name: "cost", label: "Cost", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "workshop", label: "Workshop", type: "text", half: true },
  { name: "odometer_km", label: "Odometer (km)", type: "number", half: true, step: "1" },
  { name: "next_due_on", label: "Next due date", type: "date", half: true },
  { name: "next_due_km", label: "Next due at (km)", type: "number", half: true, step: "1" },
  ledger(),
];

export const odometerFields = (vehicles: Option[]): Field[] => [
  { name: "vehicle_id", label: "Vehicle", type: "select", required: true, half: true, options: vehicles, defaultValue: vehicles[0]?.value },
  { name: "odometer_km", label: "Odometer (km)", type: "number", required: true, half: true, step: "1", hint: "The vehicle shows its highest reading." },
  { name: "logged_at", label: "When", type: "datetime", required: true, defaultValue: "now" },
  { name: "note", label: "Note", type: "text", placeholder: "Start of month" },
];

export const parkingFields = (vehicles: Option[]): Field[] => [
  { name: "vehicle_id", label: "Vehicle", type: "select", required: true, half: true, options: vehicles, defaultValue: vehicles[0]?.value },
  { name: "cost", label: "Cost", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "location", label: "Where", type: "text", placeholder: "Seksyen 13, Shah Alam" },
  { name: "started_at", label: "From", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "ended_at", label: "Until", type: "datetime", half: true, hint: "Leave empty while still parked." },
  { name: "authority", label: "Council", type: "text", half: true, placeholder: "MBSA" },
  { name: "payment_method", label: "Paid with", type: "text", half: true },
  ledger(),
];

// ---------------------------------------------------------------- projects

export const projectFields: Field[] = [
  { name: "name", label: "Build name", type: "text", required: true, placeholder: "Weather Station" },
  { name: "expense_tag", label: "Expense tag", type: "text", required: true, half: true, placeholder: "weather-station", hint: "Lowercase letters, numbers, - and _." },
  { name: "status", label: "Status", type: "select", required: true, half: true, defaultValue: "idea", options: opts(["idea", "active", "paused", "done", "abandoned"]) },
  { name: "budget", label: "Budget", type: "number", half: true, step: "0.01" },
  { name: "started_on", label: "Started on", type: "date", half: true },
  { name: "description", label: "Description", type: "textarea" },
];

export const inventoryFields: Field[] = [
  { name: "name", label: "Item", type: "text", required: true, placeholder: "ESP32-S3 DevKit" },
  { name: "category", label: "Category", type: "select", required: true, half: true, defaultValue: "other", options: opts(["sbc", "microcontroller", "sensor", "module", "display", "power", "passive", "connector", "cable", "enclosure", "tool", "storage", "networking", "other"]) },
  { name: "status", label: "Status", type: "select", required: true, half: true, defaultValue: "in_stock", options: opts(["in_stock", "in_use", "reserved", "broken", "sold"]) },
  { name: "quantity", label: "Quantity", type: "number", required: true, half: true, step: "1", defaultValue: 1 },
  { name: "unit_cost", label: "Cost each", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "reorder_level", label: "Reorder when at", type: "number", half: true, step: "1", defaultValue: 0, hint: "0 means never remind." },
  { name: "location", label: "Where it is kept", type: "text", half: true },
  { name: "vendor", label: "Bought from", type: "text" },
];

export const componentFields = (projects: Option[], items: Option[]): Field[] => [
  { name: "project_id", label: "Build", type: "select", required: true, options: projects },
  { name: "item_id", label: "Part", type: "select", required: true, options: items },
  { name: "quantity", label: "Quantity", type: "number", required: true, step: "1", min: 1, defaultValue: 1 },
];

// --------------------------------------------------------------- nutrition

export const foodLogFields = (foods: Option[]): Field[] => [
  { name: "food_id", label: "Saved food", type: "select", options: foods, hint: "Pick a saved food, or type a name and its nutrition below." },
  { name: "meal_type", label: "Meal", type: "select", required: true, half: true, defaultValue: "lunch", options: opts(["breakfast", "lunch", "dinner", "snack"]) },
  { name: "servings", label: "Servings", type: "number", required: true, half: true, step: "0.25", min: 0.25, defaultValue: 1 },
  { name: "logged_at", label: "When", type: "datetime", required: true, defaultValue: "now" },
  { name: "name", label: "Name", type: "text", placeholder: "Only needed without a saved food" },
  { name: "calories", label: "Energy (kcal)", type: "number", half: true, step: "1" },
  { name: "protein_g", label: "Protein (g)", type: "number", half: true, step: "0.1" },
  { name: "carbs_g", label: "Carbs (g)", type: "number", half: true, step: "0.1" },
  { name: "fat_g", label: "Fat (g)", type: "number", half: true, step: "0.1" },
];

export const drinkFields: Field[] = [
  { name: "beverage", label: "Drink", type: "text", required: true, half: true, defaultValue: "water" },
  { name: "volume_ml", label: "Volume (ml)", type: "number", required: true, half: true, step: "1", min: 1, defaultValue: 250 },
  { name: "caffeine_mg", label: "Caffeine (mg)", type: "number", half: true, step: "1", defaultValue: 0 },
  { name: "calories", label: "Calories (kcal)", type: "number", half: true, step: "1", defaultValue: 0, hint: "Counted in today's energy." },
  { name: "logged_at", label: "When", type: "datetime", required: true, defaultValue: "now" },
];

export const foodFields: Field[] = [
  { name: "name", label: "Food", type: "text", required: true, placeholder: "Nasi lemak" },
  { name: "brand", label: "Brand", type: "text", half: true },
  { name: "serving_size", label: "Serving size", type: "number", required: true, half: true, step: "0.1", min: 0.1, defaultValue: 100 },
  { name: "serving_unit", label: "Serving unit", type: "text", required: true, half: true, defaultValue: "g" },
  { name: "calories", label: "Energy (kcal)", type: "number", required: true, half: true, step: "1", defaultValue: 0 },
  { name: "protein_g", label: "Protein (g)", type: "number", half: true, step: "0.1", defaultValue: 0 },
  { name: "carbs_g", label: "Carbs (g)", type: "number", half: true, step: "0.1", defaultValue: 0 },
  { name: "fat_g", label: "Fat (g)", type: "number", half: true, step: "0.1", defaultValue: 0 },
  { name: "is_favorite", label: "Mark as a favourite", type: "checkbox" },
];

export const nutritionGoalFields = (goal: { calories?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; water_ml?: number; caffeine_limit_mg?: number } | null): Field[] => [
  { name: "calories", label: "Energy (kcal)", type: "number", half: true, step: "1", min: 1, defaultValue: goal?.calories ?? undefined },
  { name: "protein_g", label: "Protein (g)", type: "number", half: true, step: "1", defaultValue: goal?.protein_g ?? undefined },
  { name: "carbs_g", label: "Carbs (g)", type: "number", half: true, step: "1", defaultValue: goal?.carbs_g ?? undefined },
  { name: "fat_g", label: "Fat (g)", type: "number", half: true, step: "1", defaultValue: goal?.fat_g ?? undefined },
  { name: "water_ml", label: "Fluid (ml)", type: "number", required: true, half: true, step: "50", min: 1, defaultValue: goal?.water_ml ?? 2500 },
  { name: "caffeine_limit_mg", label: "Caffeine limit (mg)", type: "number", required: true, half: true, step: "10", defaultValue: goal?.caffeine_limit_mg ?? 400 },
];

// ----------------------------------------------------------------- fitness

const SPORTS = opts(["badminton", "tennis", "squash", "padel", "table_tennis", "pickleball"]);

export const exerciseGoalFields: Field[] = [
  { name: "name", label: "Exercise", type: "text", required: true, placeholder: "Push-ups" },
  { name: "daily_target", label: "Daily target", type: "number", required: true, half: true, step: "1", min: 1, defaultValue: 20 },
  { name: "unit", label: "Counted in", type: "select", required: true, half: true, defaultValue: "reps", options: opts(["reps", "seconds", "minutes"]) },
  { name: "is_active", label: "Active", type: "checkbox", defaultValue: true, hint: "Untick to pause this goal without losing its history." },
];

export const exerciseLogFields = (goals: Option[]): Field[] => [
  { name: "goal_id", label: "Exercise", type: "select", required: true, options: goals, defaultValue: goals[0]?.value },
  { name: "amount", label: "How many", type: "number", required: true, half: true, step: "1", min: 1 },
  { name: "logged_at", label: "When", type: "datetime", required: true, defaultValue: "now" },
];

export const workoutFields: Field[] = [
  { name: "title", label: "Session", type: "text", required: true, placeholder: "Push day" },
  { name: "kind", label: "Type", type: "select", required: true, half: true, defaultValue: "strength", options: opts(["strength", "cardio", "run", "cycling", "swim", "walk", "racket", "shooting", "mobility", "other"]) },
  { name: "performed_at", label: "When", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "duration_min", label: "Duration (min)", type: "number", half: true, step: "1", min: 1 },
  { name: "calories_burned", label: "Energy burned (kcal)", type: "number", half: true, step: "1" },
  { name: "distance_km", label: "Distance (km)", type: "number", half: true, step: "0.01" },
  { name: "avg_heart_rate", label: "Average heart rate", type: "number", half: true, step: "1", min: 30 },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const courtBookingFields: Field[] = [
  { name: "sport", label: "Sport", type: "select", required: true, half: true, defaultValue: "badminton", options: SPORTS },
  { name: "status", label: "Status", type: "select", required: true, half: true, defaultValue: "booked", options: opts(["booked", "played", "cancelled", "no_show"]) },
  { name: "venue", label: "Venue", type: "text", required: true, half: true },
  { name: "court_name", label: "Court", type: "text", half: true },
  { name: "starts_at", label: "From", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "ends_at", label: "Until", type: "datetime", required: true, half: true },
  { name: "cost", label: "Cost", type: "number", half: true, step: "0.01", defaultValue: 0 },
  { name: "booking_ref", label: "Booking reference", type: "text", half: true },
  ledger(),
];

export const racketMatchFields: Field[] = [
  { name: "sport", label: "Sport", type: "select", required: true, half: true, defaultValue: "badminton", options: SPORTS },
  { name: "match_type", label: "Format", type: "select", required: true, half: true, defaultValue: "singles", options: opts(["singles", "doubles"]) },
  { name: "opponent", label: "Opponent", type: "text", half: true },
  { name: "partner", label: "Partner", type: "text", half: true },
  { name: "played_at", label: "When", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "venue", label: "Venue", type: "text", half: true },
  { name: "games", label: "Game scores", type: "scores", required: true, placeholder: "21-17, 19-21, 21-15", hint: "Your score first, one pair per game." },
];

export const shootingFields: Field[] = [
  { name: "discipline", label: "Discipline", type: "select", required: true, half: true, defaultValue: "air_rifle", options: opts(["air_rifle", "air_pistol", "rifle", "pistol", "archery", "other"]) },
  { name: "session_at", label: "When", type: "datetime", required: true, half: true, defaultValue: "now" },
  { name: "venue", label: "Venue", type: "text", half: true },
  { name: "distance_m", label: "Distance (m)", type: "number", half: true, step: "0.1", min: 0.1 },
  { name: "total_shots", label: "Shots fired", type: "number", required: true, half: true, step: "1" },
  { name: "shots_on_target", label: "Shots on target", type: "number", required: true, half: true, step: "1" },
  { name: "total_score", label: "Score", type: "number", half: true, step: "0.1" },
  { name: "max_score", label: "Maximum score", type: "number", half: true, step: "0.1" },
  { name: "avg_group_size_mm", label: "Group size (mm)", type: "number", half: true, step: "0.1" },
  { name: "ammo_cost", label: "Ammo cost", type: "number", half: true, step: "0.01", defaultValue: 0 },
  ledger(),
];
