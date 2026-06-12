export const standardLeagueScoringSettings = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -2,
  rush_yd: 0.1,
  rush_td: 6,
  rec_yd: 0.1,
  rec_td: 6,
  fum_lost: -2
} as const;

export const halfPprLeagueScoringSettings = {
  ...standardLeagueScoringSettings,
  rec: 0.5
} as const;

export const fullPprLeagueScoringSettings = {
  ...standardLeagueScoringSettings,
  rec: 1
} as const;

export const tePremiumLeagueScoringSettings = {
  ...fullPprLeagueScoringSettings,
  rec_te_bonus: 0.5
} as const;

export const kickerLeagueScoringSettings = {
  xpm: 1,
  xpmiss: -1,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  fgmiss: -1
} as const;

export const defenseLeagueScoringSettings = {
  sack: 1,
  int: 2,
  fr: 2,
  ff: 1,
  safe: 2,
  blk_kick: 2,
  def_td: 6,
  def_st_td: 6,
  pts_allow_0: 10,
  pts_allow_1_6: 7,
  pts_allow_7_13: 4,
  pts_allow_14_20: 1,
  pts_allow_21_27: 0,
  pts_allow_28_34: -1,
  pts_allow_35p: -4
} as const;

export const idpLeagueScoringSettings = {
  solo_tkl: 2,
  ast_tkl: 1,
  tkl_loss: 2,
  sack: 4,
  qb_hit: 1,
  int: 6,
  pd: 2,
  ff: 3,
  fr: 3,
  safe: 4,
  blk_kick: 3,
  def_td: 6
} as const;
