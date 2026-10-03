/**
 * A built-in menu of common Malaysian dishes, so a meal can be logged without typing its nutrition.
 *
 * The figures are typical values for one ordinary stall or home serving, rounded. Real portions vary
 * a lot (rice quantity, oil, gravy), so treat them as estimates and edit a food after saving it if
 * yours differs.
 */
export type CatalogueGroup = "Rice" | "Masakan panas" | "Noodles" | "Western" | "Roti and breads" | "Sides and protein" | "Vegetables" | "Soups and porridge" | "Kuih and dessert" | "Drinks";

export type CatalogueFood = {
  /** Stable id used by the server actions. */
  key: string;
  name: string;
  group: CatalogueGroup;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Drinks only: one glass or cup, so logging it counts toward fluid and caffeine. */
  volume_ml?: number;
  caffeine_mg?: number;
};

const food = (key: string, name: string, group: CatalogueGroup, serving: [number, string], calories: number, protein_g: number, carbs_g: number, fat_g: number): CatalogueFood => ({
  key,
  name,
  group,
  serving_size: serving[0],
  serving_unit: serving[1],
  calories,
  protein_g,
  carbs_g,
  fat_g,
});

/** A drink: nutrition as for a dish, plus the volume and caffeine of one glass or cup. */
const drink = (key: string, name: string, serving: [number, string], volume_ml: number, caffeine_mg: number, calories: number, protein_g: number, carbs_g: number, fat_g: number): CatalogueFood => ({
  ...food(key, name, "Drinks", serving, calories, protein_g, carbs_g, fat_g),
  volume_ml,
  caffeine_mg,
});

export const CATALOGUE_GROUPS: CatalogueGroup[] = ["Rice", "Masakan panas", "Noodles", "Western", "Roti and breads", "Sides and protein", "Vegetables", "Soups and porridge", "Kuih and dessert", "Drinks"];

export const MALAYSIAN_FOODS: CatalogueFood[] = [
  // Rice
  food("nasi-lemak-biasa", "Nasi lemak biasa", "Rice", [1, "plate"], 490, 13, 80, 14),
  food("nasi-lemak-ayam", "Nasi lemak ayam goreng", "Rice", [1, "plate"], 800, 32, 86, 36),
  food("nasi-lemak-rendang", "Nasi lemak rendang daging", "Rice", [1, "plate"], 760, 30, 84, 33),
  food("nasi-lemak-bakar", "Nasi lemak bakar", "Rice", [1, "wrap"], 520, 14, 78, 17),
  food("nasi-ayam-bakar", "Nasi ayam bakar", "Rice", [1, "plate"], 720, 34, 84, 26),
  food("nasi-daging-bakar", "Nasi daging bakar", "Rice", [1, "plate"], 740, 36, 86, 27),
  food("nasi-ayam", "Nasi ayam (roasted)", "Rice", [1, "plate"], 610, 25, 75, 23),
  food("nasi-ayam-kukus", "Nasi ayam (steamed)", "Rice", [1, "plate"], 560, 26, 74, 17),
  food("nasi-campur-ayam", "Nasi campur (ayam and sayur)", "Rice", [1, "plate"], 650, 28, 82, 23),
  food("nasi-kandar-ayam", "Nasi kandar ayam, kuah campur", "Rice", [1, "plate"], 820, 35, 95, 32),
  food("nasi-briyani-ayam", "Nasi briyani ayam", "Rice", [1, "plate"], 880, 34, 102, 37),
  food("nasi-kerabu", "Nasi kerabu ayam", "Rice", [1, "plate"], 590, 27, 78, 18),
  food("nasi-kerabu-ayam-bakar", "Nasi kerabu ayam bakar", "Rice", [1, "plate"], 620, 30, 78, 19),
  food("nasi-kerabu-daging-bakar", "Nasi kerabu daging bakar", "Rice", [1, "plate"], 640, 30, 80, 20),
  food("nasi-kerabu-lemak-bakar", "Nasi kerabu lemak bakar", "Rice", [1, "plate"], 780, 26, 80, 39),
  food("nasi-dagang", "Nasi dagang gulai ikan", "Rice", [1, "plate"], 640, 24, 82, 24),
  food("nasi-tomato", "Nasi tomato ayam masak merah", "Rice", [1, "plate"], 700, 28, 92, 24),
  food("banana-leaf", "Banana leaf rice (vegetarian set)", "Rice", [1, "set"], 700, 16, 115, 19),
  food("nasi-putih", "Nasi putih", "Rice", [1, "plate"], 260, 5, 57, 0.5),

  // Masakan panas: cooked to order at the stall. Fried rice and noodles are a full plate; the lauk are
  // one serving to eat with rice (add "Nasi putih" for the rice).
  food("nasi-goreng-kampung", "Nasi goreng kampung", "Masakan panas", [1, "plate"], 640, 20, 90, 22),
  food("nasi-goreng-daging-merah", "Nasi goreng daging merah", "Masakan panas", [1, "plate"], 760, 30, 92, 29),
  food("nasi-goreng-ayam", "Nasi goreng ayam", "Masakan panas", [1, "plate"], 660, 26, 88, 23),
  food("nasi-goreng-cina", "Nasi goreng cina", "Masakan panas", [1, "plate"], 600, 18, 88, 19),
  food("nasi-goreng-pattaya", "Nasi goreng pattaya", "Masakan panas", [1, "plate"], 720, 27, 90, 28),
  food("nasi-goreng-usa", "Nasi goreng USA", "Masakan panas", [1, "plate"], 830, 34, 94, 34),
  food("nasi-goreng-tomyam", "Nasi goreng tomyam", "Masakan panas", [1, "plate"], 650, 24, 90, 21),
  food("nasi-goreng-ikan-masin", "Nasi goreng ikan masin", "Masakan panas", [1, "plate"], 640, 21, 89, 22),
  food("nasi-goreng-cili-padi", "Nasi goreng cili padi", "Masakan panas", [1, "plate"], 630, 20, 90, 21),
  food("nasi-goreng-belacan", "Nasi goreng belacan", "Masakan panas", [1, "plate"], 640, 20, 90, 22),
  food("nasi-goreng-seafood", "Nasi goreng seafood", "Masakan panas", [1, "plate"], 660, 28, 89, 21),
  food("nasi-goreng-sotong", "Nasi goreng sotong", "Masakan panas", [1, "plate"], 650, 26, 89, 21),
  food("nasi-goreng-udang", "Nasi goreng udang", "Masakan panas", [1, "plate"], 650, 27, 89, 21),
  food("nasi-goreng-paprik", "Nasi goreng paprik", "Masakan panas", [1, "plate"], 760, 30, 94, 29),
  food("nasi-goreng-mamak", "Nasi goreng mamak", "Masakan panas", [1, "plate"], 660, 20, 92, 23),
  food("nasi-paprik-ayam", "Nasi paprik ayam", "Masakan panas", [1, "plate"], 700, 30, 86, 26),
  food("nasi-paprik-daging", "Nasi paprik daging", "Masakan panas", [1, "plate"], 720, 30, 86, 28),
  food("nasi-ayam-goreng-kunyit", "Nasi ayam goreng kunyit", "Masakan panas", [1, "plate"], 730, 30, 86, 29),
  food("nasi-daging-goreng-kunyit", "Nasi daging goreng kunyit", "Masakan panas", [1, "plate"], 740, 31, 86, 30),
  food("nasi-daging-masak-merah", "Nasi daging masak merah", "Masakan panas", [1, "plate"], 730, 30, 90, 27),
  food("nasi-bujang", "Nasi bujang (nasi, telur mata, kicap)", "Masakan panas", [1, "plate"], 400, 12, 60, 12),
  food("mee-goreng-basah", "Mee goreng basah", "Masakan panas", [1, "plate"], 620, 22, 84, 21),
  food("mee-hailam", "Mee hailam", "Masakan panas", [1, "plate"], 560, 24, 72, 19),
  food("mee-hong-kong", "Mee hong kong", "Masakan panas", [1, "plate"], 600, 24, 76, 22),
  food("kuey-teow-goreng", "Kuey teow goreng", "Masakan panas", [1, "plate"], 660, 20, 86, 26),
  food("kuey-teow-kungfu", "Kuey teow kungfu", "Masakan panas", [1, "plate"], 620, 24, 78, 23),
  food("kuey-teow-ladna", "Kuey teow ladna", "Masakan panas", [1, "plate"], 600, 23, 76, 22),
  food("bihun-goreng-singapore", "Bihun goreng Singapore", "Masakan panas", [1, "plate"], 540, 18, 78, 17),
  food("mee-tomyam", "Mee tomyam", "Masakan panas", [1, "bowl"], 480, 24, 64, 14),
  food("bihun-tomyam", "Bihun tomyam", "Masakan panas", [1, "bowl"], 420, 22, 58, 11),
  food("mee-sup", "Mee sup", "Masakan panas", [1, "bowl"], 400, 20, 58, 9),
  food("bihun-sup", "Bihun sup", "Masakan panas", [1, "bowl"], 360, 19, 54, 7),
  food("maggi-sup", "Maggi sup", "Masakan panas", [1, "bowl"], 420, 14, 56, 16),
  food("maggi-tomyam", "Maggi tomyam", "Masakan panas", [1, "bowl"], 450, 17, 58, 17),
  food("paprik-ayam", "Paprik ayam", "Masakan panas", [1, "serving"], 320, 26, 14, 18),
  food("paprik-daging", "Paprik daging", "Masakan panas", [1, "serving"], 340, 26, 14, 20),
  food("paprik-campur", "Paprik campur", "Masakan panas", [1, "serving"], 330, 27, 14, 18),
  food("ayam-goreng-kunyit", "Ayam goreng kunyit", "Masakan panas", [1, "serving"], 330, 26, 8, 22),
  food("daging-goreng-kunyit", "Daging goreng kunyit", "Masakan panas", [1, "serving"], 340, 27, 8, 22),
  food("daging-masak-merah", "Daging masak merah", "Masakan panas", [1, "serving"], 330, 25, 12, 20),
  food("daging-lada-hitam", "Daging masak lada hitam", "Masakan panas", [1, "serving"], 330, 26, 12, 20),
  food("ayam-masak-halia", "Ayam masak halia", "Masakan panas", [1, "serving"], 300, 25, 10, 18),
  food("ayam-sweet-sour", "Ayam masam manis", "Masakan panas", [1, "serving"], 380, 24, 28, 19),
  food("ikan-sweet-sour", "Ikan masam manis", "Masakan panas", [1, "serving"], 360, 24, 26, 18),
  food("siakap-tiga-rasa", "Ikan siakap tiga rasa", "Masakan panas", [1, "fish"], 680, 62, 40, 30),
  food("siakap-stim-limau", "Ikan siakap stim limau", "Masakan panas", [1, "fish"], 420, 62, 8, 15),
  food("sotong-goreng-tepung", "Sotong goreng tepung", "Masakan panas", [1, "serving"], 380, 18, 30, 21),
  food("udang-goreng-tepung", "Udang goreng tepung", "Masakan panas", [1, "serving"], 390, 20, 28, 22),
  food("udang-butter", "Udang butter", "Masakan panas", [1, "serving"], 430, 22, 18, 30),
  food("tomyam-ayam", "Tomyam ayam", "Masakan panas", [1, "bowl"], 230, 22, 12, 10),
  food("tomyam-seafood", "Tomyam seafood", "Masakan panas", [1, "bowl"], 240, 25, 12, 10),
  food("tomyam-putih", "Tomyam putih", "Masakan panas", [1, "bowl"], 200, 22, 10, 8),
  food("sup-daging", "Sup daging", "Masakan panas", [1, "bowl"], 220, 22, 8, 11),
  food("sup-tulang", "Sup tulang", "Masakan panas", [1, "bowl"], 300, 24, 8, 19),
  food("sup-ekor", "Sup ekor", "Masakan panas", [1, "bowl"], 380, 28, 8, 26),
  food("sup-sayur", "Sup sayur", "Masakan panas", [1, "bowl"], 90, 4, 12, 3),
  food("kailan-ikan-masin", "Kailan ikan masin", "Masakan panas", [1, "serving"], 150, 6, 9, 10),
  food("kailan-sos-tiram", "Kailan sos tiram", "Masakan panas", [1, "serving"], 120, 4, 10, 7),
  food("telur-mata", "Telur mata", "Masakan panas", [1, "egg"], 92, 6, 0.4, 7),
  food("telur-dadar", "Telur dadar", "Masakan panas", [1, "serving"], 160, 10, 1, 13),
  food("telur-bungkus", "Telur bungkus", "Masakan panas", [1, "serving"], 270, 16, 8, 19),

  // Noodles
  food("mi-goreng-mamak", "Mi goreng mamak", "Noodles", [1, "plate"], 660, 20, 92, 22),
  food("mi-goreng-ayam-mamak", "Mi goreng ayam mamak", "Noodles", [1, "plate"], 720, 30, 92, 25),
  food("maggi-goreng", "Maggi goreng", "Noodles", [1, "plate"], 600, 16, 76, 26),
  food("mihun-goreng", "Mihun goreng", "Noodles", [1, "plate"], 510, 14, 78, 15),
  food("char-kuey-teow", "Char kuey teow", "Noodles", [1, "plate"], 740, 23, 76, 38),
  food("kuey-teow-sup", "Kuey teow sup", "Noodles", [1, "bowl"], 380, 20, 55, 8),
  food("mee-rebus", "Mee rebus", "Noodles", [1, "bowl"], 560, 22, 82, 16),
  food("mee-kari", "Mee kari", "Noodles", [1, "bowl"], 590, 20, 60, 30),
  food("laksa-asam", "Asam laksa", "Noodles", [1, "bowl"], 430, 18, 70, 8),
  food("laksa-sarawak", "Laksa Sarawak", "Noodles", [1, "bowl"], 520, 24, 56, 22),
  food("mee-bandung", "Mee bandung", "Noodles", [1, "bowl"], 520, 22, 70, 16),
  food("wantan-mee", "Wantan mee (dry)", "Noodles", [1, "plate"], 410, 19, 55, 12),
  food("pan-mee", "Pan mee sup", "Noodles", [1, "bowl"], 480, 22, 62, 15),
  food("hokkien-mee", "Hokkien mee (KL style)", "Noodles", [1, "plate"], 620, 22, 70, 28),

  // Western: kopitiam and cafe plates. Mains come with their usual sides; the sides are also listed alone.
  food("chicken-chop", "Chicken chop (black pepper, fries, coleslaw)", "Western", [1, "plate"], 950, 45, 70, 55),
  food("grilled-chicken-plate", "Grilled chicken with fries and coleslaw", "Western", [1, "plate"], 780, 42, 62, 40),
  food("grilled-chicken", "Grilled chicken", "Western", [1, "piece"], 280, 32, 3, 15),
  food("roasted-chicken", "Roasted chicken (quarter)", "Western", [1, "quarter"], 330, 30, 2, 22),
  food("lamb-chop", "Lamb chop (with sides)", "Western", [1, "plate"], 900, 40, 55, 58),
  food("beef-steak", "Beef steak (sirloin)", "Western", [200, "g"], 520, 46, 6, 34),
  food("fish-and-chips", "Fish and chips", "Western", [1, "plate"], 850, 32, 80, 44),
  food("grilled-fish-fillet", "Grilled fish fillet", "Western", [1, "fillet"], 250, 30, 4, 12),
  food("pasta-bolognese", "Pasta bolognese", "Western", [1, "plate"], 650, 28, 82, 22),
  food("spaghetti-carbonara", "Spaghetti carbonara", "Western", [1, "plate"], 780, 26, 80, 39),
  food("spaghetti-aglio-olio", "Spaghetti aglio olio (chicken)", "Western", [1, "plate"], 600, 22, 76, 23),
  food("lasagna", "Lasagna", "Western", [1, "portion"], 600, 30, 45, 33),
  food("mac-and-cheese", "Mac and cheese", "Western", [1, "bowl"], 560, 22, 58, 27),
  food("beef-burger", "Beef burger", "Western", [1, "burger"], 550, 28, 42, 30),
  food("chicken-burger", "Chicken burger", "Western", [1, "burger"], 480, 24, 45, 22),
  food("club-sandwich", "Club sandwich", "Western", [1, "sandwich"], 600, 30, 50, 30),
  food("pizza-pepperoni", "Pepperoni pizza", "Western", [2, "slices"], 600, 24, 64, 27),
  food("meatballs", "Meatballs", "Western", [3, "pieces"], 240, 14, 6, 18),
  food("sausages", "Sausages", "Western", [2, "pieces"], 300, 12, 4, 26),
  food("chicken-wings", "Fried chicken wings", "Western", [3, "pieces"], 330, 24, 6, 23),
  food("french-fries", "French fries", "Western", [1, "serving"], 330, 4, 42, 16),
  food("mashed-potato", "Mashed potato", "Western", [1, "serving"], 210, 4, 30, 8),
  food("coleslaw", "Coleslaw", "Western", [1, "serving"], 150, 1, 12, 11),
  food("garlic-bread", "Garlic bread", "Western", [2, "slices"], 240, 5, 30, 11),
  food("mushroom-soup", "Mushroom soup", "Western", [1, "bowl"], 200, 4, 16, 13),
  food("caesar-salad", "Caesar salad", "Western", [1, "bowl"], 330, 12, 14, 26),

  // Roti and breads
  food("roti-canai", "Roti canai", "Roti and breads", [1, "piece"], 300, 7, 46, 10),
  food("roti-telur", "Roti telur", "Roti and breads", [1, "piece"], 410, 14, 48, 18),
  food("roti-tisu", "Roti tisu", "Roti and breads", [1, "piece"], 470, 6, 70, 18),
  food("thosai", "Thosai", "Roti and breads", [1, "piece"], 170, 4, 30, 4),
  food("chapati", "Chapati", "Roti and breads", [1, "piece"], 140, 4, 24, 3),
  food("naan-cheese", "Cheese naan", "Roti and breads", [1, "piece"], 400, 13, 52, 15),
  food("kuah-dhal", "Kuah dhal", "Roti and breads", [1, "small bowl"], 110, 6, 15, 3),
  food("roti-bakar-kaya", "Roti bakar kaya butter", "Roti and breads", [2, "slices"], 290, 6, 40, 12),
  food("rotiboy", "Rotiboy (coffee bun)", "Roti and breads", [1, "bun"], 330, 6, 40, 16),

  // Sides and protein
  food("ayam-goreng", "Ayam goreng", "Sides and protein", [1, "piece"], 290, 22, 8, 19),
  food("ayam-masak-merah", "Ayam masak merah", "Sides and protein", [1, "piece"], 280, 22, 9, 17),
  food("kari-ayam", "Kari ayam", "Sides and protein", [1, "serving"], 300, 21, 8, 21),
  food("rendang-daging", "Rendang daging", "Sides and protein", [100, "g"], 250, 20, 6, 16),
  food("ikan-bakar", "Ikan bakar", "Sides and protein", [1, "fish"], 260, 34, 3, 12),
  food("ayam-bakar", "Ayam bakar", "Sides and protein", [1, "piece"], 300, 28, 6, 18),
  food("daging-bakar", "Daging bakar (air asam)", "Sides and protein", [150, "g"], 330, 34, 6, 19),
  food("lemak-bakar", "Lemak bakar (grilled fatty beef)", "Sides and protein", [100, "g"], 330, 18, 4, 27),
  food("sotong-bakar", "Sotong bakar", "Sides and protein", [1, "serving"], 180, 28, 6, 5),
  food("ayam-percik", "Ayam percik", "Sides and protein", [1, "piece"], 320, 27, 8, 20),
  food("satay-ayam", "Satay ayam with kuah kacang", "Sides and protein", [10, "sticks"], 480, 36, 22, 27),
  food("sambal-sotong", "Sambal sotong", "Sides and protein", [1, "serving"], 190, 16, 9, 10),
  food("sayur-campur", "Sayur campur goreng", "Sides and protein", [1, "serving"], 110, 3, 10, 7),
  food("kangkung-belacan", "Kangkung belacan", "Sides and protein", [1, "serving"], 130, 4, 8, 9),
  food("tempe-goreng", "Tempe goreng", "Sides and protein", [3, "pieces"], 190, 12, 9, 12),

  // Vegetables: plain, raw or steamed/boiled with no oil (the stir-fried ones are under Sides and Masakan panas).
  food("salad-leaves", "Mixed salad leaves", "Vegetables", [1, "bowl"], 10, 0.7, 1.5, 0.1),
  food("lettuce", "Lettuce", "Vegetables", [1, "cup"], 8, 0.6, 1.5, 0.1),
  food("garden-salad", "Garden salad with dressing", "Vegetables", [1, "bowl"], 150, 2, 8, 12),
  food("cucumber", "Timun (cucumber)", "Vegetables", [100, "g"], 15, 0.7, 3.6, 0.1),
  food("tomato", "Tomato", "Vegetables", [1, "medium"], 22, 1.1, 4.8, 0.2),
  food("carrot", "Carrot", "Vegetables", [1, "medium"], 25, 0.6, 6, 0.1),
  food("broccoli", "Broccoli (steamed)", "Vegetables", [1, "cup"], 31, 2.6, 6, 0.3),
  food("cabbage", "Kobis (cabbage, boiled)", "Vegetables", [1, "cup"], 17, 1, 4, 0.1),
  food("spinach", "Bayam (spinach, boiled)", "Vegetables", [1, "cup"], 21, 2.7, 3.4, 0.2),
  food("long-beans", "Kacang panjang (boiled)", "Vegetables", [100, "g"], 47, 2.5, 9.2, 0.1),
  food("okra", "Bendi (okra, boiled)", "Vegetables", [100, "g"], 22, 1.9, 4.5, 0.2),
  food("bean-sprouts", "Taugeh (bean sprouts)", "Vegetables", [1, "cup"], 31, 3, 6, 0.2),
  food("mixed-veg-steamed", "Mixed vegetables (steamed)", "Vegetables", [1, "cup"], 60, 3, 12, 0.3),
  food("ulam", "Ulam (raw herbs and greens)", "Vegetables", [1, "serving"], 15, 1, 3, 0.2),
  food("corn", "Jagung (corn on the cob)", "Vegetables", [1, "cob"], 90, 3.3, 19, 1.4),
  food("sweet-potato", "Keledek (sweet potato, boiled)", "Vegetables", [1, "medium"], 112, 2, 26, 0.2),
  food("avocado", "Avocado", "Vegetables", [0.5, "fruit"], 160, 2, 9, 15),

  // Soups and porridge
  food("soto-ayam", "Soto ayam", "Soups and porridge", [1, "bowl"], 430, 24, 50, 14),
  food("sup-ayam", "Sup ayam", "Soups and porridge", [1, "bowl"], 180, 18, 8, 8),
  food("tom-yam", "Tom yam campur", "Soups and porridge", [1, "bowl"], 220, 20, 12, 10),
  food("bubur-ayam", "Bubur ayam", "Soups and porridge", [1, "bowl"], 290, 15, 42, 7),
  food("lontong", "Lontong kuah lodeh", "Soups and porridge", [1, "bowl"], 480, 14, 60, 20),

  // Kuih and dessert
  food("karipap", "Karipap", "Kuih and dessert", [1, "piece"], 130, 2, 14, 7),
  food("pisang-goreng", "Pisang goreng", "Kuih and dessert", [1, "piece"], 130, 1, 22, 5),
  food("kuih-lapis", "Kuih lapis", "Kuih and dessert", [1, "piece"], 150, 1, 30, 3),
  food("onde-onde", "Onde-onde", "Kuih and dessert", [3, "pieces"], 150, 1, 30, 3),
  food("apam-balik", "Apam balik", "Kuih and dessert", [1, "piece"], 280, 7, 42, 10),
  food("cendol", "Cendol", "Kuih and dessert", [1, "bowl"], 390, 4, 62, 15),
  food("ais-kacang", "Ais kacang (ABC)", "Kuih and dessert", [1, "bowl"], 320, 6, 68, 4),

  // Drinks: logged as drinks (fluid, caffeine and calories), not as meals. Volume and caffeine are for a
  // typical kopitiam glass or cup.
  drink("air-kosong", "Air kosong (plain water)", [1, "glass"], 250, 0, 0, 0, 0, 0),
  drink("teh-tarik", "Teh tarik", [1, "glass"], 250, 40, 160, 4, 26, 5),
  drink("teh-ais", "Teh ais", [1, "glass"], 350, 40, 170, 4, 28, 5),
  drink("teh-o-panas", "Teh O panas", [1, "cup"], 250, 40, 40, 0, 10, 0),
  drink("teh-o-ais-limau", "Teh O ais limau", [1, "glass"], 350, 30, 90, 0, 23, 0),
  drink("teh-halia", "Teh halia", [1, "cup"], 250, 40, 150, 4, 25, 4),
  drink("kopi-o", "Kopi O", [1, "cup"], 200, 80, 60, 0.5, 15, 0),
  drink("kopi-susu", "Kopi (with susu pekat)", [1, "cup"], 200, 80, 130, 3, 22, 4),
  drink("kopi-ais", "Kopi ais", [1, "glass"], 350, 80, 140, 3, 23, 4),
  drink("nescafe-ais", "Nescafe ais", [1, "glass"], 350, 65, 170, 3, 30, 4),
  drink("nescafe-o-ais", "Nescafe O ais", [1, "glass"], 350, 65, 70, 0.5, 17, 0),
  drink("nescafe-tarik", "Nescafe tarik", [1, "cup"], 250, 65, 150, 4, 24, 4),
  // Aiman's own: 2 tsp decaf Nescafe (about 4 g), 1 tbsp evaporated milk, 5 tbsp low-fat milk (about 75 ml).
  drink("aimans-coffee", "Aiman's Coffee (decaf)", [1, "cup"], 200, 6, 63, 4, 6.4, 2.2),
  drink("milo-ais", "Milo ais", [1, "glass"], 350, 10, 200, 5, 34, 5),
  drink("milo-panas", "Milo panas", [1, "cup"], 250, 8, 180, 5, 30, 4.5),
  drink("neslo-ais", "Neslo ais", [1, "glass"], 350, 40, 200, 5, 33, 5),
  drink("horlicks-ais", "Horlicks ais", [1, "glass"], 350, 0, 200, 5, 34, 5),
  drink("sirap-bandung", "Sirap bandung", [1, "glass"], 350, 0, 180, 3, 34, 4),
  drink("limau-ais", "Limau ais", [1, "glass"], 350, 0, 100, 0, 26, 0),
  drink("air-kelapa", "Air kelapa", [1, "glass"], 300, 0, 50, 0.5, 11, 0.5),
  drink("soya-bean", "Air soya", [1, "glass"], 300, 0, 130, 6, 18, 4),
  drink("barli-ais", "Barli ais", [1, "glass"], 350, 0, 120, 1, 29, 0),
  drink("mata-kucing", "Air mata kucing", [1, "glass"], 300, 0, 110, 0.5, 27, 0),
  drink("cincau", "Air cincau", [1, "glass"], 350, 0, 120, 0.5, 29, 0.5),
  drink("100plus", "100PLUS", [1, "can"], 325, 0, 85, 0, 21, 0),
  drink("coca-cola", "Coca-Cola", [1, "can"], 320, 32, 140, 0, 35, 0),
];

/** The meal menu: everything except drinks. */
export const MENU_MEALS = MALAYSIAN_FOODS.filter((f) => f.group !== "Drinks");
/** The drink menu. */
export const MENU_DRINKS = MALAYSIAN_FOODS.filter((f) => f.group === "Drinks");
