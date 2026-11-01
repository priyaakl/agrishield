-- =====================================================================
-- AgriShield | 05_seed.sql   Sample data (Karnataka-flavoured)
-- All demo logins use the password:  Agri@1234
-- Dates are relative to today so the demo works whenever you run it.
-- Vectors are left NULL here; run `npm run embed` afterwards.
-- =====================================================================

-- USERS (bcrypt hashes generated inside Postgres by pgcrypto)
INSERT INTO users (user_id, full_name, email, password_hash, role) OVERRIDING SYSTEM VALUE VALUES
 (1, 'Priya Rao',      'admin@agrishield.in',     crypt('Agri@1234', gen_salt('bf', 10)), 'ADMIN'),
 (2, 'Suresh Gowda',   'inspector@agrishield.in', crypt('Agri@1234', gen_salt('bf', 10)), 'INSPECTOR'),
 (3, 'Ravi Kumar',     'ravi@example.com',        crypt('Agri@1234', gen_salt('bf', 10)), 'FARMER'),
 (4, 'Lakshmi Devi',   'lakshmi@example.com',     crypt('Agri@1234', gen_salt('bf', 10)), 'FARMER'),
 (5, 'Manjunath H',    'manjunath@example.com',   crypt('Agri@1234', gen_salt('bf', 10)), 'FARMER'),
 (6, 'Fatima Begum',   'fatima@example.com',      crypt('Agri@1234', gen_salt('bf', 10)), 'FARMER');

INSERT INTO farmers (farmer_id, user_id, phone, location_district) OVERRIDING SYSTEM VALUE VALUES
 (1, 3, '9845012345', 'Mandya'),
 (2, 4, '9741023456', 'Kolar'),
 (3, 5, '9902034567', 'Dharwad'),
 (4, 6, '8123045678', 'Raichur');

INSERT INTO land_parcels (parcel_id, farmer_id, parcel_name, survey_number, acres, soil_type, gps_latitude, gps_longitude)
OVERRIDING SYSTEM VALUE VALUES
 (1, 1, 'North paddy field', 'SY-112/2', 2.50, 'ALLUVIAL', 12.522300, 76.897000),
 (2, 1, 'Canal-side plot',   'SY-113/1', 1.75, 'CLAY',     12.524100, 76.899200),
 (3, 2, 'Tomato plot',       'SY-48/3',  1.20, 'RED',      13.136700, 78.129200),
 (4, 2, 'Hill orchard',      'SY-51',    3.00, 'LATERITE', 13.140100, 78.133800),
 (5, 3, 'Black soil field',  'SY-207/A', 4.00, 'BLACK',    15.458900, 75.007800),
 (6, 4, 'River plot',        'SY-9/4',   5.50, 'BLACK',    16.207600, 77.346300),
 (7, 4, 'East field',        'SY-10',    2.00, 'SANDY',    16.209900, 77.351100);

INSERT INTO insurance_policies (policy_id, parcel_id, crop_type, season, coverage_amount, premium_amount, start_date, end_date, status)
OVERRIDING SYSTEM VALUE VALUES
 (1, 1, 'Rice',      'KHARIF', 120000, 2400, current_date - 120, current_date + 60,  'ACTIVE'),
 (2, 3, 'Tomato',    'KHARIF',  90000, 4500, current_date - 100, current_date + 45,  'ACTIVE'),
 (3, 5, 'Cotton',    'KHARIF', 150000, 7500, current_date - 130, current_date + 50,  'ACTIVE'),
 (4, 6, 'Chilli',    'KHARIF', 110000, 5500, current_date - 110, current_date + 70,  'ACTIVE'),
 (5, 6, 'Chilli',    'KHARIF', 100000, 5000, current_date - 480, current_date - 300, 'EXPIRED'),
 (6, 2, 'Rice',      'RABI',    80000, 1200, current_date + 30,  current_date + 180, 'ACTIVE'),  -- not started yet
 (7, 7, 'Groundnut', 'KHARIF',  60000, 1200, current_date - 90,  current_date + 30,  'CANCELLED'),
 (8, 5, 'Wheat',     'RABI',   100000, 1500, current_date - 10,  current_date + 150, 'ACTIVE');

-- DISEASE KNOWLEDGE BASE (advisory text paraphrased from public extension material;
-- chemical names are indicative only — always follow the product label and local agri officer)
INSERT INTO disease_knowledgebase (disease_id, disease_name, affected_crop, pathogen_type, symptom_description, recommended_treatment, source_reference, created_by)
OVERRIDING SYSTEM VALUE VALUES
 (1, 'Rice blast', 'Rice', 'FUNGAL',
  'Spindle or diamond shaped spots on leaves with grey or whitish centres and brown margins. Spots join and leaves dry. Neck of the panicle turns black and breaks, leaving white empty grains.',
  'Grow resistant varieties, avoid excess nitrogen, keep bunds clean. A tricyclazole-based fungicide is commonly advised; follow the label and the local agriculture officer.',
  'State agricultural university package of practices', 2),
 (2, 'Bacterial leaf blight', 'Rice', 'BACTERIAL',
  'Yellowish water-soaked stripes start at the leaf tip and run down the leaf edges, turning straw coloured with wavy margins. Milky drops of ooze on leaves in the morning. Young seedlings may wilt completely (kresek).',
  'Use balanced nitrogen, drain stagnant water, avoid clipping seedling tips, grow resistant varieties. Copper-based sprays may be advised by extension staff.',
  'State agricultural university package of practices', 2),
 (3, 'Brown spot', 'Rice', 'FUNGAL',
  'Many small oval brown spots with grey centres on leaves, dark brown spots on grains and husk. More common in poor or potassium-deficient soils.',
  'Treat seed before sowing, apply balanced fertiliser especially potassium. Mancozeb-type fungicides are often advised.',
  'State agricultural university package of practices', 2),
 (4, 'Sheath blight', 'Rice', 'FUNGAL',
  'Oval greenish-grey patches on the leaf sheath near the water line that become bleached with a brown border and climb up the plant. Plants may lodge.',
  'Wider spacing, avoid excess nitrogen, remove weeds. Validamycin or hexaconazole sprays are commonly advised.',
  'State agricultural university package of practices', 2),
 (5, 'Early blight', 'Tomato', 'FUNGAL',
  'Brown spots with concentric rings like a target board on older lower leaves, often with a yellow halo. Leaves yellow and fall. Dark sunken patches near the stem end of fruits.',
  'Remove infected lower leaves, mulch, rotate crops, avoid wetting foliage. Mancozeb or chlorothalonil sprays are commonly advised.',
  'State horticulture department advisory', 2),
 (6, 'Late blight', 'Tomato', 'OTHER',
  'Large irregular greasy grey-green patches on leaves that turn brown quickly, white downy growth on the underside in humid weather, whole plants collapse within days. Firm brown patches on fruit.',
  'Destroy infected plants, avoid overhead irrigation, improve air flow. Metalaxyl plus mancozeb sprays are commonly advised during cool humid spells.',
  'State horticulture department advisory', 2),
 (7, 'Tomato leaf curl virus', 'Tomato', 'VIRAL',
  'Leaves curl upwards and become small, thick and crinkled with yellow edges. Plants are stunted and bushy, flowers drop and few fruits set. Whiteflies are seen under the leaves.',
  'No cure once infected. Pull out and destroy infected plants, raise nursery under insect net, use yellow sticky traps and recommended whitefly control, grow tolerant hybrids.',
  'State horticulture department advisory', 2),
 (8, 'Fusarium wilt', 'Tomato', 'FUNGAL',
  'Lower leaves turn yellow, often on one side of the plant, and the plant wilts in the afternoon. Cutting the stem shows brown streaks inside.',
  'Rotate with non-host crops, use resistant varieties, apply Trichoderma to soil, remove wilted plants.',
  'State horticulture department advisory', 2),
 (9, 'Bacterial blight (black arm)', 'Cotton', 'BACTERIAL',
  'Angular water-soaked spots on leaves that turn brown to black, black lesions on stems and branches (black arm), and rotting spots on bolls.',
  'Use acid-delinted treated seed and resistant varieties, remove crop debris. Copper oxychloride based sprays are commonly advised.',
  'Central cotton research advisory', 2),
 (10, 'Pink bollworm', 'Cotton', 'PEST',
  'Flowers fail to open and look twisted like a rosette. Small exit holes on green bolls, stained and damaged lint, pink larvae inside seeds.',
  'Install pheromone traps, avoid extending the crop, destroy crop residue after harvest. Use recommended insecticides only on expert advice.',
  'Central cotton research advisory', 2),
 (11, 'Anthracnose (fruit rot and die-back)', 'Chilli', 'FUNGAL',
  'Sunken circular dark spots with rings of black dots on ripe fruits, which then rot. Twigs dry from the tip downwards (die-back).',
  'Use disease-free seed, pick and destroy infected fruits, avoid overhead watering. Recommended fungicide sprays at flowering and fruiting.',
  'State horticulture department advisory', 2),
 (12, 'Chilli leaf curl', 'Chilli', 'VIRAL',
  'Leaves curl, crinkle and become small and puckered, plants stunted with short internodes and poor fruiting. Linked to whiteflies, thrips and mites.',
  'Remove infected plants early, control the insect vectors, grow a border crop such as maize, avoid planting next to infected fields.',
  'State horticulture department advisory', 2),
 (13, 'Tikka leaf spot', 'Groundnut', 'FUNGAL',
  'Circular dark brown spots on leaves, early spots with a yellow halo and later spots black without halo. Heavy leaf fall before harvest.',
  'Rotate crops, remove volunteer plants. Carbendazim or mancozeb sprays are commonly advised.',
  'State agricultural university package of practices', 2),
 (14, 'Yellow (stripe) rust', 'Wheat', 'FUNGAL',
  'Bright yellow powdery pustules arranged in stripes along the leaf veins, rubbing a leaf stains the fingers yellow. Favoured by cool weather.',
  'Grow resistant varieties, sow on time. Propiconazole sprays are commonly advised when first stripes appear.',
  'National wheat research advisory', 2),
 (15, 'Leaf (brown) rust', 'Wheat', 'FUNGAL',
  'Small round orange-brown pustules scattered on the upper surface of leaves, leaves dry early and grains shrivel.',
  'Resistant varieties and timely sowing. Triazole fungicides are commonly advised.',
  'National wheat research advisory', 2),
 (16, 'Turcicum leaf blight', 'Maize', 'FUNGAL',
  'Long elliptical cigar-shaped grey-green to tan lesions on leaves, starting on lower leaves and moving up. Leaves look scorched.',
  'Resistant hybrids, crop rotation, destroy residue. Mancozeb sprays are commonly advised.',
  'State agricultural university package of practices', 2),
 (17, 'Red rot', 'Sugarcane', 'FUNGAL',
  'Top leaves dry and droop. Splitting the cane shows red internal tissue with white cross bands and a sour alcohol smell.',
  'Use healthy setts from disease-free fields, resistant varieties, remove and burn affected clumps, avoid ratooning infected crops.',
  'Sugarcane research institute advisory', 2),
 (18, 'Panama wilt', 'Banana', 'FUNGAL',
  'Older leaves yellow from the edges and collapse, hanging around the stem like a skirt. Base of the pseudostem splits and inner tissue shows reddish-brown streaks.',
  'Use disease-free suckers, avoid planting in infected soil, remove and destroy affected plants, improve drainage.',
  'State horticulture department advisory', 2),
 (19, 'Downy mildew', 'Grape', 'OTHER',
  'Yellow oily spots on the upper leaf surface with white downy growth underneath, young bunches dry and drop.',
  'Prune for air flow, avoid wetness. Copper or other recommended fungicides on expert advice.',
  'Grape research centre advisory', 2),
 (20, 'Nitrogen deficiency', 'Rice', 'NUTRIENT',
  'Whole field looks pale. Older leaves turn uniformly yellow starting from the tip, plants are short with few tillers. No spots or lesions.',
  'Apply nitrogen in split doses as per soil test; use leaf colour chart to time top dressing.',
  'State agricultural university package of practices', 2);

-- SYMPTOM REPORTS (farmers' own words)
INSERT INTO disease_reports (report_id, parcel_id, reported_by, crop_type, symptom_text, affected_area_pct, reported_at)
OVERRIDING SYSTEM VALUE VALUES
 (1, 1, 3, 'Rice',   'Small diamond shaped spots with grey centre and brown edges on leaves. Some panicles breaking at the neck and the grains are empty.', 30, now() - interval '20 days'),
 (2, 3, 4, 'Tomato', 'Lower tomato leaves have brown spots with rings like a target. Leaves are turning yellow and falling off.', 20, now() - interval '12 days'),
 (3, 5, 5, 'Cotton', 'Flowers are not opening and look twisted like a rose. Small holes in green bolls and the cotton inside is stained.', 25, now() - interval '8 days'),
 (4, 6, 6, 'Chilli', 'Ripe red chillies have sunken black spots and are rotting. Branch tips are drying from the top.', 40, now() - interval '15 days'),
 (5, 3, 4, 'Tomato', 'Leaves curling upwards and becoming very small, lots of tiny white flies under leaves, plants not growing.', 15, now() - interval '3 days'),
 (6, 2, 3, 'Rice',   'Leaves turning yellow from the tips, plants are short and have very few tillers.', 50, now() - interval '2 days');

-- Inspector reviews (reports 1, 2, 4)
UPDATE disease_reports SET review_status = 'REVIEWED', matched_disease_id = 1,  reviewed_by = 2, reviewed_at = now() - interval '18 days',
       inspector_notes = 'Field visit confirms neck blast on ~30% of panicles.' WHERE report_id = 1;
UPDATE disease_reports SET review_status = 'REVIEWED', matched_disease_id = 5,  reviewed_by = 2, reviewed_at = now() - interval '10 days',
       inspector_notes = 'Typical target-board lesions on lower canopy.' WHERE report_id = 2;
UPDATE disease_reports SET review_status = 'REVIEWED', matched_disease_id = 11, reviewed_by = 2, reviewed_at = now() - interval '13 days',
       inspector_notes = 'Fruit rot confirmed, but most fruit was left unharvested for 3 weeks.' WHERE report_id = 4;

-- Reset identity counters after explicit ids
SELECT setval(pg_get_serial_sequence('users','user_id'),                  (SELECT MAX(user_id)    FROM users));
SELECT setval(pg_get_serial_sequence('farmers','farmer_id'),              (SELECT MAX(farmer_id)  FROM farmers));
SELECT setval(pg_get_serial_sequence('land_parcels','parcel_id'),         (SELECT MAX(parcel_id)  FROM land_parcels));
SELECT setval(pg_get_serial_sequence('insurance_policies','policy_id'),   (SELECT MAX(policy_id)  FROM insurance_policies));
SELECT setval(pg_get_serial_sequence('disease_knowledgebase','disease_id'),(SELECT MAX(disease_id) FROM disease_knowledgebase));
SELECT setval(pg_get_serial_sequence('disease_reports','report_id'),      (SELECT MAX(report_id)  FROM disease_reports));

-- CLAIMS go through the validation trigger like any real claim
INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES
 (1, 1, 45000),   -- claim 1 -> will be approved + paid
 (2, 2, 30000),   -- claim 2 -> stays pending
 (4, 4, 60000),   -- claim 3 -> will be rejected
 (3, 3, 50000);   -- claim 4 -> stays pending

-- Decisions by the admin (user 1) through the stored functions
SELECT set_config('app.current_user_id', '1', false);
SELECT fn_approve_claim_and_pay(1, 1, 45000, 'DBT-2026-000101', 'DBT', 'Neck blast confirmed by inspector');
SELECT fn_reject_claim(3, 1, 'Loss mainly due to delayed harvest, which the policy does not cover');
SELECT set_config('app.current_user_id', '', false);
