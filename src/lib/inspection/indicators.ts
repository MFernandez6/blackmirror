export type InspectionCategory =
  | "WATER"
  | "STRUCTURAL"
  | "ROOF"
  | "INTERIOR"
  | "MECHANICAL"
  | "EXTERIOR"
  | "MOLD"
  | "OTHER_STRUCTURES"
  | "CONTENTS"
  | "ALE"
  | "ADDITIONAL"
  | "CAUSATION";

export type LossType =
  | "WIND"
  | "FIRE"
  | "WATER"
  | "HAIL"
  | "VANDALISM"
  | "OTHER";

export type Severity = "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL";
export type Confidence = "CONFIRMED" | "SUSPECTED";
export type Presence = "UNSET" | "PRESENT" | "NOT_PRESENT";

export type CoverageTabId =
  | "DWELLING"
  | "WATER"
  | "WIND"
  | "MOLD"
  | "OTHER_STRUCTURES"
  | "CONTENTS"
  | "ALE"
  | "THRESHOLD";

export type IndicatorDef = {
  type: string;
  category: InspectionCategory;
  group: string;
  label: string;
  prompt: string;
  why: string;
  denial: string;
  photo: string;
  unit?: string;
  narrative: string;
};

export const CATEGORY_META: Record<
  InspectionCategory,
  { label: string; short: string }
> = {
  WATER: { label: "Water", short: "WTR" },
  STRUCTURAL: { label: "Structural", short: "STR" },
  ROOF: { label: "Roof", short: "ROF" },
  INTERIOR: { label: "Interior", short: "INT" },
  MECHANICAL: { label: "Mechanical", short: "MEC" },
  EXTERIOR: { label: "Exterior", short: "EXT" },
  MOLD: { label: "Mold", short: "MLD" },
  OTHER_STRUCTURES: { label: "Other structures", short: "B" },
  CONTENTS: { label: "Contents", short: "C" },
  ALE: { label: "Loss of use", short: "D" },
  ADDITIONAL: { label: "Additional", short: "E–F" },
  CAUSATION: { label: "Threshold", short: "THR" },
};

export const COVERAGE_TABS: {
  id: CoverageTabId;
  short: string;
  label: string;
  coverage: string;
  brief: string;
  categories: InspectionCategory[];
  systems?: InspectionCategory[];
}[] = [
  {
    id: "DWELLING",
    short: "A",
    label: "Dwelling",
    coverage: "Coverage A",
    brief: "Walk the house by system — roof, structure, interior, mechanical, envelope.",
    categories: ["ROOF", "STRUCTURAL", "INTERIOR", "MECHANICAL", "EXTERIOR"],
    systems: ["ROOF", "STRUCTURAL", "INTERIOR", "MECHANICAL", "EXTERIOR"],
  },
  {
    id: "WATER",
    short: "WTR",
    label: "Water",
    coverage: "Water peril",
    brief: "Source, path, and timing. Sudden discharge vs long-term seepage.",
    categories: ["WATER"],
  },
  {
    id: "WIND",
    short: "WND",
    label: "Wind",
    coverage: "Wind / hail",
    brief: "Crease, uplift, directional pattern, openings — not age or granule wear alone.",
    categories: ["ROOF"],
  },
  {
    id: "MOLD",
    short: "MLD",
    label: "Mold",
    coverage: "Mold / fungi",
    brief: "Visible growth, hidden cavities, HVAC, and the moisture source that ties it to a covered peril.",
    categories: ["MOLD"],
  },
  {
    id: "OTHER_STRUCTURES",
    short: "B",
    label: "Other structures",
    coverage: "Coverage B",
    brief: "Detached garage, fence, shed, screen enclosure, pool cage — not the dwelling.",
    categories: ["OTHER_STRUCTURES"],
  },
  {
    id: "CONTENTS",
    short: "C",
    label: "Contents",
    coverage: "Coverage C",
    brief: "Personal property: furniture, clothing, electronics, appliances, pack-out.",
    categories: ["CONTENTS"],
  },
  {
    id: "ALE",
    short: "D–F",
    label: "ALE / additional",
    coverage: "Coverages D–F",
    brief: "Habitability, additional living expense, trees/debris, ordinance, injury hazards.",
    categories: ["ALE", "ADDITIONAL"],
  },
  {
    id: "THRESHOLD",
    short: "THR",
    label: "Threshold",
    coverage: "Causation file",
    brief: "Document sudden vs gradual, age, maintenance, and priors before the carrier writes the denial.",
    categories: ["CAUSATION"],
  },
];

export const SEVERITY_META: Record<
  Severity,
  { label: string; className: string; hex: string }
> = {
  MINOR: {
    label: "Minor",
    className: "bg-severity-minor text-white",
    hex: "#3D7A4A",
  },
  MODERATE: {
    label: "Moderate",
    className: "bg-severity-moderate text-brand-navy",
    hex: "#C6A85B",
  },
  SEVERE: {
    label: "Severe",
    className: "bg-severity-severe text-white",
    hex: "#C45C26",
  },
  CRITICAL: {
    label: "Critical",
    className: "bg-severity-critical text-white",
    hex: "#8B0000",
  },
};

const I = (
  category: InspectionCategory,
  key: string,
  label: string,
  prompt: string,
  narrative: string,
  extras: {
    unit?: string;
    group?: string;
    why?: string;
    denial?: string;
    photo?: string;
  } = {}
): IndicatorDef => ({
  type: `${category.toLowerCase()}.${key}`,
  category,
  group: extras.group ?? CATEGORY_META[category].label,
  label,
  prompt,
  why: extras.why ?? prompt,
  denial: extras.denial ?? "Wear and tear, maintenance, or pre-existing.",
  photo: extras.photo ?? "Wide, context, close, and a scale reference.",
  unit: extras.unit,
  narrative,
});

/**
 * Closed indicator set used by the checklist AND Claude vision.
 * indicatorType values are the only legal classification outputs.
 */
export const INDICATOR_LIBRARY: IndicatorDef[] = [
  // —— WATER: timing, path, source (sudden vs long-term) ——
  I("WATER", "staining_active", "Active water staining", "Dark ring, wet/cool to touch — ongoing or recent wetting", "Active water staining was {confidence} (dark/wet ring), {severity} in extent. This presentation is consistent with recent or ongoing wetting rather than a fully dried historic stain.{notes}", { group: "Timing", why: "Wet/cool rings support a recent or continuing event tied to the date of loss.", denial: "Carrier: long-term seepage / repeated leakage exclusion.", photo: "Tide line, wet meter reading, and a dry comparison room." }),
  I("WATER", "staining_latent", "Latent water staining", "Dry tan/yellow halo — historic wetting, relevant to date-of-loss vs pre-existing", "Latent (dried) water staining was {confidence} as a tan/yellow halo, {severity} in coverage. Dry presentation is consistent with historic wetting and is material to timing arguments.{notes}", { group: "Timing", why: "Document historic stains so the file distinguishes DOL damage from priors.", denial: "Carrier: all staining is pre-existing / wear.", photo: "Dry halo vs any wet rings in the same room." }),
  I("WATER", "tide_line", "Water line / tide mark", "Horizontal line showing depth of standing or wicking water", "A water line/tide mark was {confidence}, {severity}, height {measurement}.{notes}", { group: "Timing", unit: "in", why: "Height of wetting supports volume and duration of the event.", denial: "Carrier: wicking from slab seepage, not a sudden event.", photo: "Tape measure on the tide line, corner to corner." }),
  I("WATER", "efflorescence", "Efflorescence", "Mineral deposits signaling ongoing moisture migration through masonry/concrete", "Efflorescence was {confidence} on masonry/concrete, {severity} as a signal of ongoing moisture migration.{notes}", { group: "Timing", why: "Mineral bloom often signals repeated moisture — isolate it from the storm event.", denial: "Carrier: long-term seepage; not sudden and accidental.", photo: "White bloom, substrate, and any active wet adjacent." }),
  I("WATER", "mold_mildew", "Mold / mildew on finishes", "Visible colonies on dwelling finishes (also log under Mold tab)", "Mold/mildew was {confidence} on affected surfaces, {severity} in coverage.{notes}", { group: "Secondary", why: "Ties microbial growth to a moisture event on Coverage A finishes.", denial: "Mold exclusion / fungi sublimit / long-term moisture.", photo: "Colony close-up plus the wet source in the same frame sequence." }),
  I("WATER", "musty_odor", "Musty odor", "Odor consistent with damp/microbial conditions even without visible growth", "A musty odor consistent with damp conditions was {confidence}, {severity} in intensity.{notes}", { group: "Secondary", why: "Supports hidden wetting when finishes still look clean.", denial: "No visible damage; maintenance; humidity.", photo: "Cavity, baseboard pull, or meter reading that explains the odor." }),
  I("WATER", "wood_rot", "Wood rot", "Soft, crumbling, or discolored structural/finish wood from prolonged moisture", "Wood rot was {confidence}, {severity} as to remaining section/capacity.{notes}", { group: "Secondary", why: "Rot is duration evidence — separate storm wetting from years of leak.", denial: "Wear and tear / wet rot exclusion / lack of maintenance.", photo: "Probe, section loss, and any sound wood adjacent." }),
  I("WATER", "wood_warping", "Wood warping", "Cupping, twisting, or bowing of wood from moisture cycling", "Wood warping was {confidence}, {severity} in distortion.{notes}", { group: "Secondary", why: "Cupping after a flood or leak is secondary damage, not floor age alone.", denial: "Normal wood movement / humidity / poor install.", photo: "Across-room cupping with a straightedge." }),
  I("WATER", "drywall_tape_bubble", "Drywall tape bubbling / seam separation", "Tape joint failure from wetting behind gypsum", "Drywall tape bubbling/seam separation was {confidence}, {severity} along the joints.{notes}", { group: "Path", why: "Bubbled tape over a wet cavity is a leak-path marker.", denial: "Settlement cracking / poor tape job.", photo: "Joint, stain above, and attic or exterior source." }),
  I("WATER", "ceiling_sag", "Ceiling sagging / bellying", "Gypsum or plaster belly from saturation or failed fasteners", "Ceiling sagging/bellying was {confidence}, {severity} in deflection.{notes}", { group: "Path", why: "Belly after a roof or plumbing event shows saturation, not hairline age crack.", denial: "Long-term leak; never reported; attic moisture.", photo: "Profile of belly, wet meter, attic sheathing above." }),
  I("WATER", "paint_peel_blister", "Paint peeling / blistering", "Finish failure from moisture or vapor drive", "Paint peeling/blistering was {confidence}, {severity} on affected finishes.{notes}", { group: "Path", why: "Blisters over a wet wall beat a 'paint failure' denial.", denial: "Improper paint / humidity / no covered peril.", photo: "Blister close-up and the wet source." }),
  I("WATER", "moisture_meter", "Moisture meter reading", "Numeric moisture content — not a yes/no. Record % / scale reading", "A moisture-meter reading of {measurement} was {confidence} in the sampled material, {severity} relative to dry-standard.{notes}", { group: "Timing", unit: "%", why: "Numbers vs a dry-standard room are the timing argument.", denial: "Meter not calibrated; ambient humidity; no sudden event.", photo: "Meter on wet material and the same meter on a dry control." }),
  I("WATER", "standing_water", "Standing water", "Pooled water present at inspection", "Standing water was {confidence} in the affected area, {severity} in extent.{notes}", { group: "Source", why: "Active pooling is sudden-event evidence if source is identified.", denial: "Ground water / flood / poor drainage / maintenance.", photo: "Pool, source, and whether it is stormwater vs plumbing." }),
  I("WATER", "wind_driven_rain", "Wind-driven rain at openings", "Intrusion at windows, doors, soffits, or wall penetrations during wind", "Wind-driven rain at openings was {confidence}, {severity} as a leak path.{notes}", { group: "Path", why: "Opening + wind + interior wetting is the HO wind-driven rain theory.", denial: "Wear of seals; lack of maintenance; flood; construction defect.", photo: "Failed seal/threshold, wet sill, interior stain aligned to the opening." }),
  I("WATER", "roof_leak_path", "Roof-to-interior leak path", "Stain or wet gypsum aligned under a roof breach, flashing, or penetration", "A roof-to-interior leak path was {confidence}, {severity}.{notes}", { group: "Path", why: "Stack the roof breach to the room below — don't let them split the claim.", denial: "Attic condensation; pre-existing stain; no covered roof damage.", photo: "Exterior breach, attic wet, ceiling stain in one sequence." }),
  I("WATER", "supply_line_failure", "Sudden plumbing discharge", "Burst supply, failed ice-maker line, or appliance hose — sudden release", "Sudden plumbing discharge was {confidence}, {severity}.{notes}", { group: "Source", why: "Burst/failed line is the classic sudden-and-accidental water claim.", denial: "Corroded line = wear; slow leak; not sudden.", photo: "Failed fitting, spray pattern, and corrosion vs clean break." }),
  I("WATER", "appliance_overflow", "Appliance / fixture overflow", "Washer, dishwasher, water heater, or toilet overflow", "Appliance or fixture overflow was {confidence}, {severity}.{notes}", { group: "Source", why: "Overflow from a covered system is often sudden if the fail is identified.", denial: "Overflow exclusion; drain clog = maintenance; gradual.", photo: "Appliance, floor wetting, and the failed part." }),
  I("WATER", "window_door_intrusion", "Window / door intrusion", "Wet track, failed threshold, blown rain at sliding glass", "Window/door intrusion was {confidence}, {severity}.{notes}", { group: "Path", why: "Tracks and thresholds are the usual wind-driven rain entry.", denial: "Clogged track = maintenance; worn weatherstrip = age.", photo: "Track debris vs storm-driven volume; wet interior at the same opening." }),
  I("WATER", "insulation_saturation", "Saturated insulation", "Attic, wall, or floor insulation wet or compressed from wetting", "Saturated insulation was {confidence}, {severity}.{notes}", { group: "Secondary", why: "Wet insulation is R-value loss and hidden damage — tear-out argument.", denial: "Pre-existing attic moisture; ventilation; no sudden leak.", photo: "Wet batts vs dry, with the leak origin." }),
  I("WATER", "cabinet_wicking", "Cabinet / vanity wicking", "Swollen toe-kick, delam, or stain from below or behind cabinets", "Cabinet/vanity wicking was {confidence}, {severity}.{notes}", { group: "Secondary", why: "Kitchen/bath cabinets are high-dollar secondary from a water event.", denial: "Plumbing drip over years; particle board age.", photo: "Toe-kick, interior shelf, and the wet source." }),

  // —— STRUCTURAL ——
  I("STRUCTURAL", "crack_hairline", "Hairline cracking", "Fine surface crack, typically cosmetic unless mapped with displacement", "Hairline cracking was {confidence}, {severity}, measured at {measurement}.{notes}", { group: "Cracking", unit: "mm", why: "Map cosmetic vs displaced so the carrier cannot call everything settlement.", denial: "Settlement / age / not storm-related.", photo: "Crack with scale; note if it is new vs oxidized." }),
  I("STRUCTURAL", "crack_structural", "Structural cracking", "Through-member or displacement crack, not cosmetic map cracking", "Structural cracking was {confidence}, {severity}, width {measurement}. Displacement/through-section character distinguishes this from cosmetic cracking.{notes}", { group: "Cracking", unit: "mm", why: "Displacement is the difference between paint and a structural claim.", denial: "Long-term settlement; earth movement exclusion.", photo: "Through-crack, offset, and a plumb/level reference." }),
  I("STRUCTURAL", "crack_stairstep", "Stair-step cracking", "Stepped pattern typically in masonry mortar joints", "Stair-step cracking was {confidence} in masonry, {severity}, width {measurement}.{notes}", { group: "Cracking", unit: "mm", why: "Stair-step after wind/soil event vs historic differential settlement.", denial: "Settlement; poor mortar; age.", photo: "Full pattern from corner, width with scale." }),
  I("STRUCTURAL", "crack_vertical", "Vertical cracking", "Vertical orientation on wall/foundation", "Vertical cracking was {confidence}, {severity}, width {measurement}.{notes}", { group: "Cracking", unit: "mm" }),
  I("STRUCTURAL", "crack_horizontal", "Horizontal cracking", "Horizontal orientation — often more significant in foundation walls", "Horizontal cracking was {confidence}, {severity}, width {measurement}.{notes}", { group: "Cracking", unit: "mm", why: "Horizontal foundation cracks are rarely 'just paint.'", denial: "Hydrostatic / long-term / earth movement.", photo: "Length, width, bow of the wall." }),
  I("STRUCTURAL", "foundation_settlement", "Foundation settlement", "Differential settlement, tilted planes, stepped openings", "Foundation settlement was {confidence}, {severity} in differential.{notes}", { group: "Foundation", why: "If present, isolate storm damage from the settlement so the file is honest — and so they cannot dump the whole claim.", denial: "Earth movement exclusion; wear; not a covered peril.", photo: "Level across floors, door heads, exterior grade." }),
  I("STRUCTURAL", "foundation_heaving", "Foundation heaving", "Upward displacement of slab/footing", "Foundation heaving was {confidence}, {severity} in upward displacement.{notes}", { group: "Foundation" }),
  I("STRUCTURAL", "spalling_concrete", "Spalling concrete", "Face loss, exposed aggregate/rebar", "Concrete spalling was {confidence}, {severity} with face loss.{notes}", { group: "Foundation", denial: "Age of concrete; corrosion; maintenance." }),
  I("STRUCTURAL", "joint_displacement", "Joint displacement / misalignment", "Offset at control joints, connections, or assembled members", "Displacement/misalignment at joints was {confidence}, {severity}, offset {measurement}.{notes}", { group: "Frame", unit: "mm" }),
  I("STRUCTURAL", "member_deflection", "Sagging / deflection of members", "Joist, beam, rafter, or lintel deflection", "Deflection of a structural member was {confidence}, {severity}.{notes}", { group: "Frame", why: "Deflection after water/wind load is more than a cosmetic ceiling crack.", denial: "Long-term overload; undersized lumber; age." }),
  I("STRUCTURAL", "wall_ceiling_separation", "Wall–ceiling separation", "Gap at wall-to-ceiling junction", "Separation at the wall–ceiling junction was {confidence}, {severity}, gap {measurement}.{notes}", { group: "Frame", unit: "mm", why: "Fresh white gap vs dirty historic gap is the prior-vs-DOL tell.", denial: "Normal framing movement; settlement.", photo: "Gap with scale; paint/dirt in the crack." }),
  I("STRUCTURAL", "wall_floor_separation", "Wall–floor separation", "Gap at wall-to-floor junction", "Separation at the wall–floor junction was {confidence}, {severity}, gap {measurement}.{notes}", { group: "Frame", unit: "mm" }),
  I("STRUCTURAL", "frame_racking", "Door/window frame racking", "Opening will not close square; out-of-plumb jambs", "Door/window frame racking was {confidence}, {severity} — opening will not close square.{notes}", { group: "Frame", why: "A door that will not latch after a storm is racking, not a 'sticky door.'", denial: "Humidity swell; poor install; settlement.", photo: "Reveal around the slab, latch, and exterior of the opening." }),
  I("STRUCTURAL", "brick_veneer_crack", "Brick veneer cracking", "Cracked brick or mortar in veneer wythe", "Brick veneer cracking was {confidence}, {severity}.{notes}", { group: "Veneer" }),
  I("STRUCTURAL", "brick_veneer_bow", "Brick veneer bowing", "Outward/inward bow of veneer", "Brick veneer bowing was {confidence}, {severity}.{notes}", { group: "Veneer" }),
  I("STRUCTURAL", "truss_rafter_shift", "Truss / rafter shift", "Displaced truss, rafter, or hurricane clip after wind load", "Truss/rafter shift was {confidence}, {severity}.{notes}", { group: "Frame", why: "Attic connections are where wind load shows up after a named storm.", denial: "Original construction; missing straps = code, not this storm.", photo: "Clip, slot, and any fresh wood split." }),

  // —— ROOF / WIND ——
  I("ROOF", "missing_shingles", "Missing shingles", "Displaced or absent covering units", "Missing shingles were {confidence}, {severity} in area of loss.{notes}", { group: "Covering", why: "Missing units are the cleanest wind-damage photo.", denial: "Blown off over time; poor adhesion; age; not this storm.", photo: "Field, ridge, and the missing-tab close-up with underlayment." }),
  I("ROOF", "lifted_shingles", "Lifted / unsealed shingles", "Unsealed/lifted tabs without full displacement", "Lifted/unsealed shingles were {confidence}, {severity}.{notes}", { group: "Covering", why: "Unsealed tabs after wind are often denied as 'never sealed' — photograph the sealant tear.", denial: "Never sealed from install; heat; age.", photo: "Underside of tab: factory seal vs torn asphalt." }),
  I("ROOF", "granule_loss", "Granule loss", "Accelerated wear — exposed mat, granule piles in gutters", "Granule loss was {confidence}, {severity} in density (accelerated-wear signal).{notes}", { group: "Covering", why: "Granule loss alone is usually wear — use it to support hail/wind only with impact or crease.", denial: "Normal aging; not a covered peril.", photo: "Exposed mat vs protected slope; gutter granules." }),
  I("ROOF", "creased_shingles", "Creased shingles", "Wind-damage crease signature vs. foot-traffic scuff", "Creased shingles were {confidence}, {severity}. Crease geometry is the wind-damage signature as distinct from foot-traffic scuffing.{notes}", { group: "Covering", why: "Crease is the wind signature. Scuff is traffic. Photograph the fold, not just the color change.", denial: "Foot traffic; hail bruises; manufacturing wrinkle.", photo: "Profile of the crease, granule fracture along the fold." }),
  I("ROOF", "backed_out_nails", "Exposed / backed-out nail heads", "Fasteners proud of the covering", "Exposed or backed-out nail heads were {confidence}, {severity}.{notes}", { group: "Covering", denial: "Improper fastening at install; not storm." }),
  I("ROOF", "flashing_separation", "Flashing separation", "Step, counter, valley, or wall flashing pulled/open", "Flashing separation was {confidence}, {severity} as a leak path.{notes}", { group: "Openings", why: "Open flashing is both wind damage and the leak path to the interior.", denial: "Rusted / unmaintained flashing; age.", photo: "Open hem, fastener pull, interior stain below." }),
  I("ROOF", "fascia_damage", "Fascia damage", "Split, missing, or wind-torn fascia", "Fascia damage was {confidence}, {severity}.{notes}", { group: "Edge" }),
  I("ROOF", "soffit_damage", "Soffit damage", "Detached, punctured, or blown soffit", "Soffit damage was {confidence}, {severity}, with openings into the eaves.{notes}", { group: "Edge", why: "Blown soffit is wind entry into the attic — look for insulation blow and wet sheathing.", denial: "Vinyl sag from heat; pest; age." }),
  I("ROOF", "gutter_detachment", "Gutter detachment", "Pulled hangers, separated runs, or downspout failure", "Gutter detachment was {confidence}, {severity}.{notes}", { group: "Edge", denial: "Clogged gutters / hanger rust / maintenance." }),
  I("ROOF", "decking_delamination", "Decking delamination", "Plywood/OSB face separation or wet delam", "Decking delamination was {confidence}, {severity}.{notes}", { group: "Deck", why: "Wet delam is often hidden until you look in the attic after a roof breach.", denial: "Long-term leak; original wet install; wear." }),
  I("ROOF", "edge_uplift", "Uplift at ridge or roof edges", "Ridge, rake, or eave uplift", "Uplift at the ridge or roof edges was {confidence}, {severity}.{notes}", { group: "Uplift", why: "Edges fail first in wind. Ridge and rakes are the money photos.", denial: "Poor nail pattern; age; not this event." }),
  I("ROOF", "hail_spatter", "Hail spatter / bruising", "Impact marks consistent with hail (when applicable)", "Hail impact marks were {confidence}, {severity} in bruise density.{notes}", { group: "Impact", why: "Random, directional bruises on soft metal and shingles beat 'wear' denials.", denial: "Blisters; foot traffic; age spots.", photo: "Soft metal test (AC fins, vents), shingle bruises, and a coin for scale." }),
  I("ROOF", "ridge_vent_shift", "Ridge vent / cap displacement", "Ridge vent, cap shingles, or hip caps lifted or missing", "Ridge vent or cap displacement was {confidence}, {severity}.{notes}", { group: "Uplift", why: "Ridge is the first thing wind takes — and the first leak path.", denial: "Improper install; plastic fatigue." }),
  I("ROOF", "pipe_boot_failure", "Pipe boot / jack failure", "Split, displaced, or missing pipe boot exposing the penetration", "Pipe boot/jack failure was {confidence}, {severity}.{notes}", { group: "Openings", why: "A torn boot is a discrete opening. Rubber dry-rot vs storm tear is the fight.", denial: "UV failure / wear of rubber; maintenance.", photo: "Tear vs cracked collar; wet sheathing below." }),
  I("ROOF", "drip_edge_rake", "Drip edge / rake damage", "Bent, missing, or lifted metal edge", "Drip-edge or rake damage was {confidence}, {severity}.{notes}", { group: "Edge" }),
  I("ROOF", "vent_displacement", "Vent / turtle / off-ridge displacement", "Off-ridge vents lifted, missing, or unfastened", "Vent displacement was {confidence}, {severity}.{notes}", { group: "Openings" }),
  I("ROOF", "skylight_damage", "Skylight damage", "Broken glazing, displaced curb, or failed flashing at skylight", "Skylight damage was {confidence}, {severity}.{notes}", { group: "Openings", denial: "Failed seal age; not impact." }),
  I("ROOF", "collateral_wind", "Collateral / directional wind pattern", "Same-direction damage on this roof, trees, screens, or adjacent property", "A directional/collateral wind pattern was {confidence}, {severity}.{notes}", { group: "Pattern", why: "One missing shingle is an argument. A directional pattern on the house and the neighbor is a storm.", denial: "Isolated wear; no storm in the area.", photo: "Street, trees, screens, and the damaged slope in one direction." }),
  I("ROOF", "impact_debris", "Debris / missile impact", "Punctures or fractures from tree limbs or wind-borne debris", "Debris/missile impact was {confidence}, {severity}.{notes}", { group: "Impact", why: "Impact is accidental and sudden — photograph the missile if it is still on site.", denial: "Pre-existing hole; poor repair." }),

  // —— INTERIOR ——
  I("INTERIOR", "drywall_seam_failure", "Drywall seam / tape joint failure", "Joint compound crack, tape peel, not necessarily wet", "Drywall seam/tape joint failure was {confidence}, {severity}.{notes}", { group: "Finishes", denial: "Settlement / poor tape / age." }),
  I("INTERIOR", "texture_mismatch", "Texture mismatch / prior repair", "Evidence of prior repair — material to pre-existing damage disputes", "Texture mismatch was {confidence}, {severity}. Inconsistent texture is evidence of prior repair and is material to pre-existing damage disputes.{notes}", { group: "Priors", why: "Photograph priors yourself so the carrier cannot invent them — and so you can isolate the new damage.", denial: "Entire area is old repair; no new storm damage.", photo: "Mismatch next to unrepaired storm damage." }),
  I("INTERIOR", "flooring_separation", "Flooring separation", "Gaps at planks, transitions, or perimeter", "Flooring separation was {confidence}, {severity}.{notes}", { group: "Floors", denial: "Humidity; install; wear." }),
  I("INTERIOR", "flooring_buckling", "Flooring buckling", "Tented, peaked, or detached covering", "Flooring buckling was {confidence}, {severity}.{notes}", { group: "Floors", why: "Buckle after wetting is secondary damage, not 'the floor was old.'", denial: "No moisture; expansion gap missing at install." }),
  I("INTERIOR", "tile_lippage", "Tile lippage", "Adjacent tile height mismatch", "Tile lippage was {confidence}, {severity}, offset {measurement}.{notes}", { group: "Floors", unit: "mm" }),
  I("INTERIOR", "baseboard_gapping", "Baseboard gapping", "Pull-away from wall or floor", "Baseboard gapping was {confidence}, {severity}, gap {measurement}.{notes}", { group: "Finishes", unit: "mm" }),
  I("INTERIOR", "attic_sheathing_stain", "Attic sheathing stains", "Water staining or microbial growth on roof decking viewed from attic", "Attic sheathing stains were {confidence}, {severity}.{notes}", { group: "Attic", why: "The attic is where roof leaks prove up. Fresh dark vs oxidized historic.", denial: "Old attic moisture; ventilation; no covered roof damage.", photo: "Stained bay, corresponding exterior, ceiling below." }),
  I("INTERIOR", "closet_cavity_wet", "Closet / cavity wetting", "Hidden wet in closets, behind tubs, or interior corners", "Closet or cavity wetting was {confidence}, {severity}.{notes}", { group: "Hidden", why: "Carriers skip closets. That is where the meter still reads wet.", denial: "Not reported; no visible living-area damage." }),
  I("INTERIOR", "trim_swelling", "Trim / jamb swelling", "Swollen casings, sills, or jambs from wetting", "Trim/jamb swelling was {confidence}, {severity}.{notes}", { group: "Finishes" }),
  I("INTERIOR", "matching_line_of_sight", "Matching / line of sight", "Damaged finish that will not match remaining undamaged material in the same room", "A matching/line-of-sight issue was {confidence}, {severity}.{notes}", { group: "Matching", why: "Florida matching and continuous-surface arguments live or die on these photos.", denial: "Repair only the damaged piece; no matching owed.", photo: "Damaged run continuing into undamaged of the same material." }),

  // —— MECHANICAL ——
  I("MECHANICAL", "corrosion_rust", "Corrosion / rust staining at fixtures", "Rust at connections, valves, supply lines", "Corrosion/rust staining at fixtures or connections was {confidence}, {severity}.{notes}", { group: "Plumbing", why: "Rust can be the carrier's 'wear' photo — or the failed fitting that burst.", denial: "Wear and tear; not sudden.", photo: "Failed part vs adjacent corrosion; spray pattern." }),
  I("MECHANICAL", "active_leak", "Active leak evidence", "Drip, wet joint, or spray at time of inspection", "Active leak evidence was {confidence}, {severity}.{notes}", { group: "Plumbing", why: "Active drip at inspection is still an event if the failure is identified.", denial: "You should have shut the water off; maintenance." }),
  I("MECHANICAL", "water_heater_pan_stain", "Water heater pan staining", "Residue/stain in overflow pan", "Water-heater pan staining was {confidence}, {severity}.{notes}", { group: "Plumbing", denial: "Long-term drip; anode/age of tank." }),
  I("MECHANICAL", "hvac_coil_corrosion", "HVAC coil corrosion", "Evaporator/condenser coil corrosion or freeze evidence", "HVAC coil corrosion was {confidence}, {severity}.{notes}", { group: "HVAC" }),
  I("MECHANICAL", "condensate_line", "Condensate line issues", "Clogged, disconnected, or overflowing condensate", "Condensate-line issues were {confidence}, {severity}.{notes}", { group: "HVAC", denial: "Maintenance; clogged line exclusion." }),
  I("MECHANICAL", "water_heater_failure", "Water heater failure", "Tank leak, T&P discharge, or failed element housing", "Water-heater failure was {confidence}, {severity}.{notes}", { group: "Plumbing", why: "Failed tank is sudden if the shell opened — photograph the rupture, not just the rust.", denial: "End of useful life; wear." }),
  I("MECHANICAL", "shower_pan_fail", "Shower pan / surround failure", "Failed pan, cracked surround, or wet adjacent framing", "Shower pan/surround failure was {confidence}, {severity}.{notes}", { group: "Plumbing", denial: "Grout maintenance; long-term seepage." }),
  I("MECHANICAL", "hvac_inoperable", "HVAC inoperable after event", "System will not cool/heat following water, wind, or power event", "HVAC inoperable after the event was {confidence}, {severity}.{notes}", { group: "HVAC", why: "Dead HVAC is Coverage A equipment and a Coverage D habitability fact.", denial: "Old unit; no storm-related failure." }),

  // —— EXTERIOR ENVELOPE ——
  I("EXTERIOR", "stucco_map_crack", "Stucco map cracking", "Interconnected hairline pattern — typically cosmetic", "Stucco map cracking was {confidence}, {severity}. Map pattern is typically cosmetic as distinct from diagonal/structural cracking.{notes}", { group: "Cladding", why: "Call map cracking what it is so diagonal cracks stand up.", denial: "All stucco cracks are age." }),
  I("EXTERIOR", "stucco_diagonal_crack", "Stucco diagonal / structural crack", "Oriented crack through stucco, often opening-to-opening", "Diagonal/structural stucco cracking was {confidence}, {severity}, distinct from cosmetic map cracking.{notes}", { group: "Cladding" }),
  I("EXTERIOR", "siding_buckling", "Siding buckling", "Panels/planks buckled from moisture or fastener failure", "Siding buckling was {confidence}, {severity}.{notes}", { group: "Cladding" }),
  I("EXTERIOR", "siding_warping", "Siding warping", "Cupped or twisted cladding", "Siding warping was {confidence}, {severity}.{notes}", { group: "Cladding" }),
  I("EXTERIOR", "window_seal_failure", "Window seal failure", "Fogging between panes / failed IGU", "Window seal failure (fogging between panes) was {confidence}, {severity}.{notes}", { group: "Openings", denial: "Failed IGU is wear; not wind." }),
  I("EXTERIOR", "caulk_failure", "Caulk failure at penetrations", "Open, cracked, or missing sealant at openings/penetrations", "Caulk failure at penetrations was {confidence}, {severity}.{notes}", { group: "Openings", why: "Failed caulk is the favorite maintenance denial — photograph storm-driven wetting through it, not just the crack.", denial: "Lack of maintenance; wear of sealant." }),
  I("EXTERIOR", "screen_damage", "Window / lanai screen damage", "Torn, blown, or detached insect screens (dwelling-attached)", "Screen damage was {confidence}, {severity}.{notes}", { group: "Openings", why: "Screens are small-dollar but they prove wind on this elevation.", denial: "Age of screen; not a covered item." }),
  I("EXTERIOR", "impact_cladding", "Impact to cladding", "Dents, punctures, or fractures from debris", "Impact to cladding was {confidence}, {severity}.{notes}", { group: "Impact" }),
  I("EXTERIOR", "entry_door_damage", "Entry / garage door damage", "Dented, racked, or failed door, track, or weatherseal", "Entry or garage door damage was {confidence}, {severity}.{notes}", { group: "Openings", why: "Garage doors fail in wind and then the house pressurizes. Photograph tracks and panels.", denial: "Dent from years of use; poor springs." }),

  // —— MOLD ——
  I("MOLD", "visible_growth_a", "Visible growth on dwelling", "Colonies on gypsum, wood, or finishes (Coverage A)", "Visible mold growth on dwelling finishes was {confidence}, {severity}.{notes}", { group: "Dwelling", why: "Mold follows a moisture event. Photograph the source in the same inspection.", denial: "Mold exclusion; fungi sublimit; long-term moisture; not sudden.", photo: "Colony, wet source, and meter." }),
  I("MOLD", "hidden_cavity", "Hidden / cavity mold", "Growth behind baseboards, vinyl, or in wall cavities", "Hidden/cavity mold was {confidence}, {severity}.{notes}", { group: "Dwelling", why: "If you do not open a wet cavity, the carrier will say there is no mold.", denial: "Invasive testing not warranted; no visible damage." }),
  I("MOLD", "hvac_contamination", "HVAC / duct contamination", "Growth or debris in air handler, coil, or supply runs", "HVAC/duct contamination was {confidence}, {severity}.{notes}", { group: "HVAC", denial: "Dirty ducts = maintenance; not this loss." }),
  I("MOLD", "contents_growth", "Growth on contents", "Colonies on furniture, clothing, or stored goods", "Mold growth on contents was {confidence}, {severity}.{notes}", { group: "Contents", why: "Contents mold is Coverage C plus pack-out — do not leave it on A only.", denial: "Unrelated humidity; delayed mitigation." }),
  I("MOLD", "moisture_source_tied", "Moisture source identified", "The wet origin that fed the growth is documented", "A moisture source feeding the growth was {confidence}, {severity}.{notes}", { group: "Causation", why: "Mold without a covered water event is an exclusion. Tie it.", denial: "No covered peril; humidity; poor ventilation." }),
  I("MOLD", "duration_under_72h", "Growth consistent with recent wetting", "Presentation more consistent with days/weeks than years of damp", "Growth consistent with recent wetting was {confidence}, {severity}.{notes}", { group: "Causation", why: "Push back on 'this has been growing for years' when the stain is still active.", denial: "Long-term condition; insured delay." }),
  I("MOLD", "remediation_scope", "Remediation / tear-out indicated", "Material that cannot be cleaned in place — remove and replace", "Remediation/tear-out was {confidence} as indicated, {severity}.{notes}", { group: "Scope", why: "Cleaning vs tear-out is the estimate fight. Photograph why it cannot be cleaned." }),
  I("MOLD", "odor_without_visible", "Musty odor without visible colonies", "Odor of microbial VOCs; finishes still closed", "Musty odor without visible colonies was {confidence}, {severity}.{notes}", { group: "Hidden", denial: "Subjective; no covered damage." }),

  // —— COVERAGE B ——
  I("OTHER_STRUCTURES", "detached_garage", "Detached garage / carport", "Damage to a structure not attached to the dwelling", "Detached garage/carport damage was {confidence}, {severity}.{notes}", { group: "Buildings", why: "If it is not attached, it is B — do not leave it off the A estimate.", denial: "Not on the policy; wear; not storm." }),
  I("OTHER_STRUCTURES", "shed_outbuilding", "Shed / outbuilding", "Storage shed, workshop, or similar", "Shed/outbuilding damage was {confidence}, {severity}.{notes}", { group: "Buildings" }),
  I("OTHER_STRUCTURES", "fence_gate", "Fence / gate", "Panel blow-down, racked posts, or failed gate", "Fence/gate damage was {confidence}, {severity}.{notes}", { group: "Yard", why: "Fences are B and they prove wind direction. Count panels.", denial: "Rotten posts = wear; not this storm.", photo: "Failed panel, post condition (rot vs clean break), direction of fall." }),
  I("OTHER_STRUCTURES", "screen_enclosure", "Screen enclosure / lanai cage", "Pool cage, patio cage, or screen room not the dwelling", "Screen enclosure/lanai cage damage was {confidence}, {severity}.{notes}", { group: "Cage", why: "Cages are often the largest B item on a Florida wind claim.", denial: "Frame corrosion; screen age; not a covered structure." }),
  I("OTHER_STRUCTURES", "pool_spa_deck", "Pool / spa / deck", "Coping, screen, equipment pad, or deck around pool", "Pool/spa/deck damage was {confidence}, {severity}.{notes}", { group: "Yard" }),
  I("OTHER_STRUCTURES", "driveway_walk", "Driveway / walk / pad", "Cracked, displaced, or debris-scarred hardscape if other-structure", "Driveway/walk/pad damage was {confidence}, {severity}.{notes}", { group: "Yard", denial: "Settlement; wear of concrete." }),
  I("OTHER_STRUCTURES", "mailbox_lamp", "Mailbox / lamp post", "Struck, leaning, or missing yard structures", "Mailbox or lamp-post damage was {confidence}, {severity}.{notes}", { group: "Yard" }),
  I("OTHER_STRUCTURES", "retaining_not_dwelling", "Retaining / yard wall", "Wall that retains yard, not the dwelling foundation", "Retaining/yard wall damage was {confidence}, {severity}.{notes}", { group: "Yard", denial: "Earth movement; wear." }),
  I("OTHER_STRUCTURES", "play_structure", "Play structure / pergola", "Detached amenity damaged in the event", "Play structure/pergola damage was {confidence}, {severity}.{notes}", { group: "Yard" }),
  I("OTHER_STRUCTURES", "b_wind_pattern", "B structures — same wind event", "Other structures damaged in the same direction as the dwelling", "Other-structure damage consistent with the dwelling wind event was {confidence}, {severity}.{notes}", { group: "Pattern", why: "B damage in the same vector as A undercuts 'isolated wear on the house.'" }),

  // —— COVERAGE C ——
  I("CONTENTS", "furniture", "Furniture damage", "Stain, swell, finish loss, or odor on furniture", "Furniture damage was {confidence}, {severity}.{notes}", { group: "Household", why: "Contents are C. If you only write A, the insured eats the furniture.", denial: "Pre-existing stain; wear; delayed mitigation." }),
  I("CONTENTS", "textiles", "Clothing / textiles", "Wet, stained, or microbial textiles", "Clothing/textile damage was {confidence}, {severity}.{notes}", { group: "Household" }),
  I("CONTENTS", "electronics", "Electronics", "Water, surge, or impact to TVs, computers, appliances of a personal nature", "Electronics damage was {confidence}, {severity}.{notes}", { group: "Household", denial: "Power surge exclusion; age of device." }),
  I("CONTENTS", "appliances", "Personal appliances", "Washer, dryer, refrigerator, or similar damaged by the event", "Personal appliance damage was {confidence}, {severity}.{notes}", { group: "Household" }),
  I("CONTENTS", "kitchen_contents", "Kitchen contents / food", "Food spoilage, cookware, pantry loss", "Kitchen contents/food loss was {confidence}, {severity}.{notes}", { group: "Household", why: "Spoilage after power or flood is often missed. Note duration without refrigeration." }),
  I("CONTENTS", "documents_media", "Documents / media", "Wet papers, photos, or records", "Document/media damage was {confidence}, {severity}.{notes}", { group: "Household" }),
  I("CONTENTS", "packout_needed", "Pack-out indicated", "Volume of contents that cannot be cleaned in place", "Pack-out was {confidence} as indicated, {severity}.{notes}", { group: "Scope", why: "Pack-out is the difference between a contents estimate and a garbage bag." }),
  I("CONTENTS", "scheduled_vs_unscheduled", "High-value / scheduled items", "Items that may be scheduled or exceed sublimits (jewelry, art, guns)", "High-value/scheduled contents issues were {confidence}, {severity}.{notes}", { group: "Limits", why: "Flag sublimits in the field so the office does not miss a scheduled endorsement." }),
  I("CONTENTS", "contents_mold", "Contents — microbial", "Growth or odor on personal property", "Microbial damage to contents was {confidence}, {severity}.{notes}", { group: "Household", denial: "Mold exclusion on C; delayed drying." }),
  I("CONTENTS", "debris_of_contents", "Debris of contents", "Destroyed personal property that must be removed", "Debris of contents was {confidence}, {severity}.{notes}", { group: "Scope" }),

  // —— D ALE ——
  I("ALE", "uninhabitable", "Dwelling uninhabitable", "Cannot reasonably occupy (sleep, cook, sanitation, climate)", "The dwelling was {confidence} uninhabitable, {severity} as to duration/scope.{notes}", { group: "Habitability", why: "Coverage D starts when the house cannot be lived in. Write the facts: kitchen, bath, HVAC, bedrooms.", denial: "Still livable; insured chose to leave; delay." }),
  I("ALE", "no_kitchen", "Kitchen out of service", "Cannot prepare meals on site", "Kitchen out of service was {confidence}, {severity}.{notes}", { group: "Habitability" }),
  I("ALE", "no_bath", "Bath / sanitation out", "No functioning bath or toilet on site", "Bath/sanitation out of service was {confidence}, {severity}.{notes}", { group: "Habitability" }),
  I("ALE", "no_hvac_power", "No HVAC or power", "Climate or electrical service not available after the event", "Loss of HVAC or power was {confidence}, {severity}.{notes}", { group: "Habitability" }),
  I("ALE", "no_water_service", "No domestic water", "Supply shut or contaminated; cannot occupy", "Loss of domestic water was {confidence}, {severity}.{notes}", { group: "Habitability" }),
  I("ALE", "hotel_needed", "Additional living expense likely", "Hotel, meals, or relocation indicated", "Additional living expense was {confidence} as indicated, {severity}.{notes}", { group: "Expense", why: "Tell the insured to keep receipts tonight. D is reimbursement of extra expense." }),
  I("ALE", "fair_rental", "Fair rental value (if rented)", "Loss of rents if the insured is a landlord on this risk", "Fair rental value exposure was {confidence}, {severity}.{notes}", { group: "Expense" }),
  I("ALE", "civil_authority", "Civil authority / access", "Ordered out or access blocked", "Civil-authority or access restriction was {confidence}, {severity}.{notes}", { group: "Expense", denial: "No order; voluntary evacuation." }),

  // —— E–F / additional ——
  I("ADDITIONAL", "debris_removal", "Debris removal", "Fallen tree, building debris, or contents debris to be hauled", "Debris-removal need was {confidence}, {severity}.{notes}", { group: "Additional", why: "Debris is often a separate limit. Photograph the pile and what it came off of." }),
  I("ADDITIONAL", "trees_shrubs", "Trees / shrubs / lawn", "Covered plantings damaged (watch the small sublimit)", "Tree/shrub/lawn damage was {confidence}, {severity}.{notes}", { group: "Additional", denial: "Only if it damaged a covered structure; sublimit.", photo: "Tree on the house vs tree in the yard only." }),
  I("ADDITIONAL", "ordinance_law", "Ordinance or law", "Code upgrade likely if rebuilding (roof, electrical, flood vents)", "Ordinance-or-law exposure was {confidence}, {severity}.{notes}", { group: "Additional", why: "Flag code in the field. The office cannot add it later without photos of what fails current code." }),
  I("ADDITIONAL", "reasonable_repairs", "Reasonable repairs / mitigation", "Tarps, board-up, water extraction already done or still needed", "Reasonable repairs/mitigation were {confidence}, {severity}.{notes}", { group: "Additional", why: "Mitigation preserves the claim. Note what is still open to weather." }),
  I("ADDITIONAL", "liability_hazard", "Injury / liability hazard (E)", "Unsafe condition that could injure occupant or guest", "A liability/injury hazard was {confidence}, {severity}.{notes}", { group: "E–F", why: "Not the property estimate — but log trip, open roof, or live electric for the file.", denial: "Not a first-party property issue." }),
  I("ADDITIONAL", "medical_guest", "Guest injury condition (F)", "Condition on premises relevant to medical payments", "A guest-injury condition was {confidence}, {severity}.{notes}", { group: "E–F" }),

  // —— THRESHOLD / CAUSATION (denial preemption) ——
  I("CAUSATION", "sudden_accidental", "Sudden and accidental presentation", "A defined event with a beginning — burst, wind, impact, overflow", "A sudden-and-accidental presentation was {confidence}, {severity}.{notes}", { group: "Covered theory", why: "This is the sentence the denial letter tries to erase. Photograph the event, not just the stain.", denial: "Not sudden; ongoing condition.", photo: "Failed part, wind pattern, or overflow — plus the resulting damage." }),
  I("CAUSATION", "long_term_seepage", "Long-term / repeated seepage indicators", "Evidence the carrier will call constant or repeated seepage or leakage", "Long-term/repeated seepage indicators were {confidence}, {severity}.{notes}", { group: "Exclusions", why: "If the tell is there, document it and separate the storm wetting from the old drip. Honesty wins the rest of the claim.", denial: "Entire loss excluded as CSE/RSL.", photo: "Oxidized stain vs fresh wet; rot duration vs new tide line." }),
  I("CAUSATION", "wear_tear_age", "Wear, tear, and age", "Deterioration the carrier will call uncovered wear", "Wear/tear/age conditions were {confidence}, {severity}.{notes}", { group: "Exclusions", why: "Photograph age next to storm damage so they cannot paint the whole roof as 'old.'", denial: "Wear and tear; deterioration; inherent vice." }),
  I("CAUSATION", "maintenance", "Maintenance-related condition", "Clogged drain, failed caulk, dirty filters — isolate from the peril", "Maintenance-related conditions were {confidence}, {severity}.{notes}", { group: "Exclusions", why: "Admit the clogged track. Then show the volume of wind-driven rain that still entered.", denial: "Lack of maintenance; neglect." }),
  I("CAUSATION", "priors", "Prior damage / prior repairs", "Historic loss, unmatched patches, or old permits", "Prior damage or repairs were {confidence}, {severity}.{notes}", { group: "Priors", why: "You find the priors before the desk adjuster does. Isolate new from old.", denial: "Pre-existing; prior claim; no new damage." }),
  I("CAUSATION", "construction_defect", "Construction / install defect", "Nail pattern, unsealed tabs from day one, missing flashing", "Construction/install defect was {confidence}, {severity}.{notes}", { group: "Exclusions", why: "Defect may be a separate theory — do not let it swallow storm-created openings.", denial: "Faulty workmanship; not a covered peril." }),
  I("CAUSATION", "flood_vs_wind", "Flood vs wind-driven rain", "Below-grade or rising water vs rain through a wind-created opening", "Flood vs wind-driven-rain distinction was {confidence}, {severity}.{notes}", { group: "Water theory", why: "In Florida this is the claim. Photograph elevation of wetting vs flood line vs openings.", denial: "Flood exclusion; anti-concurrent causation.", photo: "Exterior flood line, interior height, and the roof/window opening." }),
  I("CAUSATION", "earth_movement", "Settlement / earth movement tell", "Pattern more consistent with movement than with this peril", "Settlement/earth-movement indicators were {confidence}, {severity}.{notes}", { group: "Exclusions", denial: "Earth movement exclusion." }),
  I("CAUSATION", "matching_dispute", "Matching will be disputed", "Same-room material that cannot be repaired invisibly", "A matching dispute is anticipated; condition was {confidence}, {severity}.{notes}", { group: "Threshold", why: "Line-of-sight and discontinued product. Photograph the run, not one tile." }),
  I("CAUSATION", "delay_mitigation", "Mitigation delay risk", "Still open to weather or wet — clock is running on 'failure to protect'", "Mitigation-delay risk was {confidence}, {severity}.{notes}", { group: "Threshold", why: "If the tarp is not on, say so and get it on. Do not gift a failure-to-protect denial.", denial: "Insured failed to protect the property." }),
  I("CAUSATION", "dry_standard", "Dry-standard comparison", "Unaffected room or elevation used as control", "A dry-standard/control comparison was {confidence}, {severity}.{notes}", { group: "Covered theory", why: "One wet meter reading is an opinion. Wet vs dry-standard is a file.", photo: "Same meter, affected vs unaffected." }),
  I("CAUSATION", "date_of_loss_tie", "Date-of-loss tie-in", "Damage presentation consistent with the reported DOL / storm date", "A date-of-loss tie-in was {confidence}, {severity}.{notes}", { group: "Covered theory", why: "Fresh breaks, green wood, unoxidized metal vs dirty historic — write it.", denial: "Damage predates the reported loss." }),
];

export const INDICATOR_BY_TYPE: Record<string, IndicatorDef> = Object.fromEntries(
  INDICATOR_LIBRARY.map((i) => [i.type, i])
);

export const INDICATOR_TYPES = INDICATOR_LIBRARY.map((i) => i.type);

export const CATEGORIES: InspectionCategory[] = [
  "WATER",
  "STRUCTURAL",
  "ROOF",
  "INTERIOR",
  "MECHANICAL",
  "EXTERIOR",
  "MOLD",
  "OTHER_STRUCTURES",
  "CONTENTS",
  "ALE",
  "ADDITIONAL",
  "CAUSATION",
];

export const PERIL_CATEGORIES: Record<LossType, InspectionCategory[]> = {
  WATER: [...CATEGORIES],
  WIND: [...CATEGORIES],
  HAIL: [...CATEGORIES],
  FIRE: [...CATEGORIES],
  VANDALISM: [...CATEGORIES],
  OTHER: [...CATEGORIES],
};

export function indicatorsForPeril(peril: LossType): IndicatorDef[] {
  const cats = new Set(PERIL_CATEGORIES[peril] ?? CATEGORIES);
  return INDICATOR_LIBRARY.filter((i) => cats.has(i.category));
}

export function indicatorsByCategory(peril: LossType) {
  const list = indicatorsForPeril(peril);
  const map = new Map<InspectionCategory, IndicatorDef[]>();
  for (const cat of CATEGORIES) {
    const items = list.filter((i) => i.category === cat);
    if (items.length) map.set(cat, items);
  }
  return map;
}

export function coverageTabById(id: CoverageTabId) {
  return COVERAGE_TABS.find((t) => t.id === id) ?? COVERAGE_TABS[0];
}

export function defaultCoverageTab(peril: LossType): CoverageTabId {
  if (peril === "WATER") return "WATER";
  if (peril === "WIND" || peril === "HAIL") return "WIND";
  return "DWELLING";
}

export const ALL_COVERAGE_TAB_IDS: CoverageTabId[] = COVERAGE_TABS.map(
  (tab) => tab.id
);

/** New walks start with every coverage off. Empty still means “all apply” for older sessions. */
export function defaultSkippedCoverages(): CoverageTabId[] {
  return [...ALL_COVERAGE_TAB_IDS];
}

export function isTabSkipped(
  id: CoverageTabId,
  skipped: CoverageTabId[] | undefined
) {
  return (skipped ?? []).includes(id);
}

export function isSystemSkipped(
  category: InspectionCategory,
  skipped: InspectionCategory[] | undefined
) {
  return (skipped ?? []).includes(category);
}

/** Item still needs a Finding / Not observed if any active coverage still includes it. */
export function isItemRequired(
  category: InspectionCategory,
  skippedCoverages: CoverageTabId[] | undefined,
  skippedSystems: InspectionCategory[] | undefined
) {
  const skippedTabs = skippedCoverages ?? [];
  const skippedSys = skippedSystems ?? [];
  for (const tab of COVERAGE_TABS) {
    if (skippedTabs.includes(tab.id)) continue;
    if (!tab.categories.includes(category)) continue;
    if (tab.systems && skippedSys.includes(category)) continue;
    return true;
  }
  return false;
}

export function isIndicatorType(value: string): boolean {
  return value in INDICATOR_BY_TYPE;
}
