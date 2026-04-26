export const WAVELENGTHS = {
    g: {nm: 435.84, color: "violet"},   // violet / blue-violet
    F: {nm: 486.1, color: "blue"},    // blue
    e: {nm: 546.07, color: "green"},   // green
    d: {nm: 587.56, color: "yellow"},   // yellow
    C: {nm: 656.27, color: "red"},   // red
    r: {nm: 706.52, color: "deep red"},   // deep red
  };

export const FRAUNHOFER_REFRACTIVE_INDICES = {
    air: {
      F: 1,
      e: 1,
      d: 1,
      C: 1,
    },
    // bk-7
    crown_glass: {
        g: 1.526684, // 435.84 nm
        F: 1.522379, // 486.10 nm
        e: 1.518722, // 546.07 nm
        d: 1.516800, // 587.56 nm
        C: 1.514322, // 656.27 nm
        r: 1.512892, // 706.52 nm
    },  
    // 저굴절 CR-39 계열
    plastic_150 : {
        F: 1.50738,
        e: 1.50200,
        d: 1.50000,
        C: 1.49860,
    },
    // 중굴절 MR-8 계열
    plastic_160 : {
        F: 1.61800,
        e: 1.60720,
        d: 1.60000,
        C: 1.59430,
    },
    // 고굴절 MR-174
    plastic_167 : {
        F: 1.68600,
        e: 1.67300,
        d: 1.67000,
        C: 1.66200,
    },
    // 초고굴절 MR-174
    plastic_174 : {
        F: 1.76100,
        e: 1.74800,
        d: 1.74000,
        C: 1.73200,
    },
    cornea: {
      F: 1.377468,
      e: 1.376502,
      d: 1.376,
      C: 1.375368,
    },  
    aqueous: {
      F: 1.337312,
      e: 1.336449,
      d: 1.336,
      C: 1.335435,
    },  
    vitreous: {
      F: 1.337312,
      e: 1.336449,
      d: 1.336,
      C: 1.335435,
    },  
    lens: {
      F: 1.407585,
      e: 1.406542,
      d: 1.406,
      C: 1.405318,
    },  
    lens_anterior: {
      F: 1.387507,
      e: 1.386516,
      d: 1.386,
      C: 1.385351,
    },  
    lens_nucleus_anterior: {
      F: 1.407585,
      e: 1.406542,
      d: 1.406,
      C: 1.405318,
    },  
    lens_nucleus_posterior: {
      F: 1.387507,
      e: 1.386516,
      d: 1.386,
      C: 1.385351,
    },  
    lens_posterior: {
      F: 1.337312,
      e: 1.336449,
      d: 1.336,
      C: 1.335435,
    },
  };

  export const PUPIL_DIAMETER = {
    /** 축동 — 동공 수축 */
    constricted: 2.5,
    /** 일반 */
    neutral: 4,
    /** 산동 — 동공 확대 */
    dilated: 6,
  }

  export const EMMERTROPIC_DIOPTERS = 60;

  export const CORNEA_SIZE = {
    horizontal: 11.8,  // mm (평균)
    vertical: 11.0,    // mm (수평보다 작음)
  }
  
  export const CRYLSTALLINE_LENS_SIZE = {
    horizontal: 9.6,   // mm (평균)
    vertical: 9.2,     // mm (약간 타원)
  }