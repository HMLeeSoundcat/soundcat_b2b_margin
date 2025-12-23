export interface 개별품목타입 {
  no_id: number;
  brand: string;
  PROD_CD: string;
  product: string;
  hidden: number;
  stock: number;
  soldout: number;
  price: number;
  default_margin: 마진타입;
  href: string | undefined;
  edited?: boolean;
}

export interface 품목목록타입 {
  [key: string]: 개별품목타입[];
}

export interface 마진설정값타입 {
  default_margin: number | string | undefined;
  default_prov: number | string | undefined;
  discount_margin: number | string | undefined;
  discount_price: number | string | undefined;
  discount_qty: number | string | undefined;
  brand_disc_amount?: number | string | undefined;
}

export interface 마진타입 extends 마진설정값타입 {
  link_def: boolean;
  link_disc: boolean;
  per_user: {
    [key: string]: Omit<마진설정값타입, "brand_disc_amount">;
  };
}

export interface 아이디목록타입 {
  mb_no: string;
  mb_id: string;
  mb_nick: string;
  mb_8: string;
}

export interface 품목테이블컬럼속성타입 {
  [key: string]: {
    width: string;
    display: boolean;
    label: string;
  };
}
