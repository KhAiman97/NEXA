/**
 * A built-in menu of common Malaysian dishes, so a meal can be logged without typing its nutrition.
 *
 * The figures are typical values for one ordinary stall or home serving, rounded. Real portions vary
 * a lot (rice quantity, oil, gravy), so treat them as estimates and edit a food after saving it if
 * yours differs.
 */
export type CatalogueGroup = "Rice" | "Noodles" | "Roti and breads" | "Sides and protein" | "Soups and porridge" | "Kuih and dessert" | "Drinks";

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

export const CATALOGUE_GROUPS: CatalogueGroup[] = ["Rice", "Noodles", "Roti and breads", "Sides and protein", "Soups and porridge", "Kuih and dessert", "Drinks"];

export const MALAYSIAN_FOODS: CatalogueFood[] = [
  // Rice
  food("nasi-lemak-biasa", "Nasi lemak biasa", "Rice", [1, "plate"], 490, 13, 80, 14),
  food("nasi-lemak-ayam", "Nasi lemak ayam goreng", "Rice", [1, "plate"], 800, 32, 86, 36),
  food("nasi-lemak-rendang", "Nasi lemak rendang daging", "Rice", [1, "plate"], 760, 30, 84, 33),
  food("nasi-ayam", "Nasi ayam (roasted)", "Rice", [1, "plate"], 610, 25, 75, 23),
  food("nasi-ayam-kukus", "Nasi ayam (steamed)", "Rice", [1, "plate"], 560, 26, 74, 17),
  food("nasi-goreng-kampung", "Nasi goreng kampung", "Rice", [1, "plate"], 640, 20, 90, 22),
  food("nasi-goreng-ayam", "Nasi goreng ayam", "Rice", [1, "plate"], 660, 26, 88, 23),
  food("nasi-goreng-pattaya", "Nasi goreng pattaya", "Rice", [1, "plate"], 720, 27, 90, 28),
  food("nasi-campur-ayam", "Nasi campur (ayam and sayur)", "Rice", [1, "plate"], 650, 28, 82, 23),
  food("nasi-kandar-ayam", "Nasi kandar ayam, kuah campur", "Rice", [1, "plate"], 820, 35, 95, 32),
  food("nasi-briyani-ayam", "Nasi briyani ayam", "Rice", [1, "plate"], 880, 34, 102, 37),
  food("nasi-kerabu", "Nasi kerabu ayam", "Rice", [1, "plate"], 590, 27, 78, 18),
  food("nasi-dagang", "Nasi dagang gulai ikan", "Rice", [1, "plate"], 640, 24, 82, 24),
  food("nasi-tomato", "Nasi tomato ayam masak merah", "Rice", [1, "plate"], 700, 28, 92, 24),
  food("banana-leaf", "Banana leaf rice (vegetarian set)", "Rice", [1, "set"], 700, 16, 115, 19),
  food("nasi-putih", "Nasi putih", "Rice", [1, "plate"], 260, 5, 57, 0.5),

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

  // Roti and breads
  food("roti-canai", "Roti canai", "Roti and breads", [1, "piece"], 300, 7, 46, 10),
  food("roti-telur", "Roti telur", "Roti and breads", [1, "piece"], 410, 14, 48, 18),
  food("roti-tisu", "Roti tisu", "Roti and breads", [1, "piece"], 470, 6, 70, 18),
  food("thosai", "Thosai", "Roti and breads", [1, "piece"], 170, 4, 30, 4),
  food("chapati", "Chapati", "Roti and breads", [1, "piece"], 140, 4, 24, 3),
  food("naan-cheese", "Cheese naan", "Roti and breads", [1, "piece"], 400, 13, 52, 15),
  food("kuah-dhal", "Kuah dhal", "Roti and breads", [1, "small bowl"], 110, 6, 15, 3),
  food("roti-bakar-kaya", "Roti bakar kaya butter", "Roti and breads", [2, "slices"], 290, 6, 40, 12),

  // Sides and protein
  food("ayam-goreng", "Ayam goreng", "Sides and protein", [1, "piece"], 290, 22, 8, 19),
  food("ayam-masak-merah", "Ayam masak merah", "Sides and protein", [1, "piece"], 280, 22, 9, 17),
  food("kari-ayam", "Kari ayam", "Sides and protein", [1, "serving"], 300, 21, 8, 21),
  food("rendang-daging", "Rendang daging", "Sides and protein", [100, "g"], 250, 20, 6, 16),
  food("ikan-bakar", "Ikan bakar", "Sides and protein", [1, "fish"], 260, 34, 3, 12),
  food("satay-ayam", "Satay ayam with kuah kacang", "Sides and protein", [10, "sticks"], 480, 36, 22, 27),
  food("telur-mata", "Telur mata", "Sides and protein", [1, "egg"], 92, 6, 0.4, 7),
  food("telur-dadar", "Telur dadar", "Sides and protein", [1, "serving"], 160, 10, 1, 13),
  food("sambal-sotong", "Sambal sotong", "Sides and protein", [1, "serving"], 190, 16, 9, 10),
  food("sayur-campur", "Sayur campur goreng", "Sides and protein", [1, "serving"], 110, 3, 10, 7),
  food("kangkung-belacan", "Kangkung belacan", "Sides and protein", [1, "serving"], 130, 4, 8, 9),
  food("tempe-goreng", "Tempe goreng", "Sides and protein", [3, "pieces"], 190, 12, 9, 12),

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

  // Drinks
  food("teh-tarik", "Teh tarik", "Drinks", [1, "glass"], 160, 4, 26, 5),
  food("teh-o-ais-limau", "Teh O ais limau", "Drinks", [1, "glass"], 90, 0, 23, 0),
  food("kopi-o", "Kopi O", "Drinks", [1, "cup"], 60, 0.5, 15, 0),
  food("kopi-susu", "Kopi (with susu pekat)", "Drinks", [1, "cup"], 130, 3, 22, 4),
  food("milo-ais", "Milo ais", "Drinks", [1, "glass"], 200, 5, 34, 5),
  food("sirap-bandung", "Sirap bandung", "Drinks", [1, "glass"], 180, 3, 34, 4),
  food("air-kelapa", "Air kelapa", "Drinks", [1, "glass"], 50, 0.5, 11, 0.5),
  food("limau-ais", "Limau ais", "Drinks", [1, "glass"], 100, 0, 26, 0),
];
