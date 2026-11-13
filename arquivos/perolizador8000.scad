// =====================================================================
// PEROLIZADOR 8000: cabecote + bicos + aneis + adaptadores de seringa + pecas de teste
// Uso:  openscad -o X.stl -D 'part="cabecote"' perolizador8000.scad
//
// part (impressao, tudo deitado em z=0):
//   "cabecote" | "bico" | "anel" | "adaptador_luer" | "adaptador_cateter" | "adaptador_grosso"
//   "placa_cabecote" "placa_bicos" (15 bicos) "placa_aneis" (2) "placa_adaptadores" (3)
//   "teste_pote" "teste_bloco" "teste_encaixes" (anel + bloco + pino numa placa so)
// part (uso / site 3D, z para cima, topo da face superior do cabecote em z=28):
//   "web_cabecote" "web_bico" "web_anel" "web_adaptador_luer|cateter|grosso"
// part (previews coloridos): "montado" | "corte"
//
// NOTAS DE IMPRESSAO E MONTAGEM
//  1) Imprima ANTES (15 min): teste_pote (anel sobre a boca do pote) e teste_encaixes
//     (soquete do adaptador, furo de cola e pino da espiga). Ajuste folga / folga_cone /
//     luer_comp se algo ficar justo ou folgado.
//  2) Cabecote: face superior plana (soquete) sobre a mesa, furos dos bicos para cima.
//     Canais em gota e funil a 45 graus: sem suporte.
//  3) Bicos: ESPIGA PARA BAIXO na mesa, ponta para cima, com brim. Colar com EPOXI nos
//     furos femea (folga_cola); a face larga (d=7) assenta no teto plano do encaixe.
//  4) Adaptadores: imprimir em pe sobre a ponta do cone (soquete para cima), com brim,
//     sem suporte (a parte de baixo do flange e chanfro de 45 graus).
//     Encaixam no soquete conico 1:5 do cabecote por friccao (folga_cone=0; aumente
//     para folgar, diminua (negativo) para apertar). No encaixe nominal sobra 1,5 mm
//     entre o flange e a face superior do cabecote.
//  5) Seringa: Luer slip/lock (adaptador luer, sem rosquear), cateter (50-100 ml,
//     bico d 5-9) e grosso (bico d 9-14).
// =====================================================================

part = "cabecote";   // peca a gerar (ver lista acima)

// ---------------- Pote ----------------
pote_d            = 55;    // diametro externo da boca do pote (mm)
folga             = 0.6;   // folga de encaixe (mm)
encaixe_d         = pote_d + folga;           // diametro do encaixe (55.6)
pote_prof_interna = 35;    // profundidade interna a partir da borda (20 corpo + 15 gargalo)
folga_fundo       = 6;     // distancia da ponta dos bicos ao fundo do pote (mm)
L                 = pote_prof_interna - folga_fundo;  // comprimento do bico: assento -> ponta (29)

// ---------------- Corpo ----------------
parede    = 3.2;                              // parede externa (mm)
corpo_d   = encaixe_d + 2*parede;             // diametro externo do corpo (62)
encaixe_h = 4;                                // profundidade do encaixe (teto plano apoia na borda do pote)
altura    = 28;                               // altura do cabecote (face superior em z=28)

// ---------------- Bicos (posicoes) ----------------
r_interno    = 7;     // raio do circulo interno de bicos
n_interno    = 4;     // quantidade de bicos internos
ang0_interno = 45;    // angulo inicial dos bicos internos (graus)
r_externo    = 16.5;  // raio do circulo externo de bicos
n_externo    = 9;     // quantidade de bicos externos
ang0_externo = 0;     // angulo inicial dos bicos externos (graus)

// ---------------- Bico (peca separada) ----------------
bico_base_d   = 7;     // diametro da face larga (assento no teto do encaixe)
bico_ponta_d  = 3.6;   // diametro da ponta do bico
furo_bico_d   = 1.8;   // diametro do furo passante do bico
espiga_bico_d = 4.0;   // diametro da espiga macho do bico
espiga_bico_h = 5;     // comprimento da espiga (do fundo ate o plano de assento)
folga_cola    = 0.25;  // folga diametral para cola (epoxi)
bico_assento_h = 0.6;  // pequeno cilindro d=bico_base_d logo apos o assento
bico_cham_base = 0.3;  // chanfro na borda inferior da espiga
bico_alarga_d  = espiga_bico_d + 1;  // alargamento 45 graus da espiga junto ao assento
furo_femea_d   = espiga_bico_d + folga_cola; // furo femea no cabecote (4.25)
furo_femea_h   = espiga_bico_h + 0.5;        // profundidade do furo acima do teto (5.5)
furo_femea_cham = 0.5; // chanfro 45 graus na boca do furo

// ---------------- Canais e camara ----------------
canal_d   = 3.5;     // diametro do canal radial (secao gota)
canal_z   = 12;      // altura do eixo dos canais
camara_r  = 4.5;     // raio da camara central
camara_zt = 15;      // topo da camara
camara_apice_z = 7;  // fundo da camara em cone 45 graus (sem ponte plana ao imprimir); >= teto+3

// ---------------- Soquete conico do cabecote (adaptadores) ----------------
soq_boca_d   = 14.0;  // diametro na face superior (z=altura)
soq_prof     = 12;    // profundidade do cone
soq_conic    = 0.2;   // conicidade 1:5 no diametro (mm de diametro por mm de profundidade)
soq_fundo_d  = soq_boca_d - soq_conic*soq_prof;   // 11.6
soq_fundo_z  = altura - soq_prof;                 // 16
soq_cham     = 0.5;   // chanfro na boca

// ---------------- Adaptadores ----------------
folga_cone    = 0;     // folga diametral aplicada ao cone macho (+ folga, - aperta)
ad_gap        = 1.5;   // vao nominal entre a parte de baixo do flange e a face superior
ad_ponta_alt  = 1.0;   // ponta do cone fica 1 mm acima do fundo do soquete
flange_d      = 22;
flange_h      = 3;     // parte reta do flange (acima do chanfro de 45 graus)
// Luer (ISO 80369-7, 6%)
luer_comp     = 0.15;
luer_boca_d   = 4.30 + luer_comp;
luer_prof     = 7.5;
luer_fundo_d  = luer_boca_d - 0.06*luer_prof;
luer_cubo_d   = 6.4;
luer_cubo_h   = 8;
luer_furo_d   = 2.5;
// cateter
cat_corpo_d = 16;  cat_corpo_h = 16;
cat_boca_d  = 10;  cat_fundo_d = 4.5;  cat_prof = 16;  cat_furo_d = 4;
// grosso
gro_corpo_d = 22;  gro_corpo_h = 18;
gro_boca_d  = 15;  gro_fundo_d = 8;    gro_prof = 18;  gro_furo_d = 5;

// ---------------- Aneis espacadores ----------------
camada    = 8;                 // altura (e elevacao) de cada anel
espiga_h  = 3.5;               // altura da espiga superior
espiga_d  = encaixe_d - 0.5;   // diametro externo da espiga (55.1)
anel_id   = 50;                // diametro interno passante do anel
espiga_chanfro = 0.5;          // chanfro externo no topo da espiga

// ---------------- Placas e testes ----------------
sep          = 7;      // distancia minima entre pecas nas placas (>= 6)
placa_cols   = 5;
placa_rows   = 3;
placa_passo  = bico_base_d + sep;   // 14
teste_pote_h = 3;
teste_bloco_w = 34;  teste_bloco_d = 22;  teste_bloco_h = 16;  teste_bloco_r = 3;
pino_d = espiga_bico_d;  pino_h = espiga_bico_h;

// ---------------- Resolucao ----------------
fn_g = 64;   // circulos grandes
fn_p = 32;   // circulos pequenos
fn_a = 64;   // cones de encaixe (soquete e adaptadores)
eps  = 0.01;

// ---------------- Derivados ----------------
topo_z        = altura;
canal_fundo_z = canal_z - canal_d/2*sqrt(2);        // ponta da gota
function ad_d(z) = soq_boca_d - soq_conic*(altura - z) + folga_cone;  // diam. do cone macho na cota de uso z
ad_ponta_z    = soq_fundo_z + ad_ponta_alt;          // cota de uso da ponta do cone (17)
ad_flange_z   = altura + ad_gap;                     // cota de uso da base do flange (29.5)
ad_cone_len   = ad_flange_z - ad_ponta_z;            // 12.5
ad_cham_h     = flange_d/2 - ad_d(ad_flange_z)/2;    // chanfro 45 graus ate o flange
ad_flange_top = ad_cone_len + ad_cham_h + flange_h;  // topo do flange (local)
funil_z0      = soq_fundo_z - (soq_fundo_d/2 - camara_r);  // funil 45 graus ate a camara (14.7)

luer_hub_wall = (luer_cubo_d - luer_boca_d)/2;
fluxo_min     = min([furo_bico_d, canal_d, 2*camara_r, luer_fundo_d, luer_furo_d,
                     cat_fundo_d, cat_furo_d, gro_fundo_d, gro_furo_d]);

// ---------------- Verificacoes ----------------
assert(anel_id > 2*(r_externo + bico_base_d/2) + 2, "anel_id muito pequeno para os bicos passarem");
assert(espiga_d < encaixe_d, "espiga deve caber no encaixe");
assert(canal_fundo_z - encaixe_h >= 3, "menos de 3 mm de solido sobre o teto do encaixe");
assert(camara_apice_z - encaixe_h >= 3, "fundo da camara muito perto do teto do encaixe");
assert(funil_z0 >= camara_apice_z, "funil desce abaixo do fundo da camara");
assert(fluxo_min >= 1.8, "diametro minimo do fluxo < 1.8 mm");
assert(luer_hub_wall >= 0.9, "parede do cubo Luer < 0.9 mm");
assert(soq_boca_d/2 + soq_cham < corpo_d/2 - 3, "soquete muito perto da parede externa");
assert(ad_cham_h > 0, "flange menor que o cone");

echo(str("PAREDES: teto-do-encaixe a ponta da gota = ", canal_fundo_z - encaixe_h,
         " mm; teto-do-encaixe a camara (apice) = ", camara_apice_z - encaixe_h,
         " mm; soquete a parede externa = ", corpo_d/2 - soq_boca_d/2 - soq_cham,
         " mm; furo femea externo a parede = ", corpo_d/2 - r_externo - furo_femea_d/2 - furo_femea_cham, " mm"));
echo(str("PAREDES adaptadores: cubo Luer na boca = ", luer_hub_wall, " mm; cateter na boca = ",
         (cat_corpo_d - cat_boca_d)/2, " mm; grosso na boca = ", (gro_corpo_d - gro_boca_d)/2,
         " mm; bico na ponta = ", (bico_ponta_d - furo_bico_d)/2, " mm"));
echo(str("FLUXO minimo = ", fluxo_min, " mm (bico/ligacao ", furo_bico_d, ")"));
echo(str("FLANGE: vao nominal = ", ad_gap, " mm (z flange ", ad_flange_z, "); cone d ", ad_d(ad_ponta_z), "..", ad_d(ad_flange_z),
         "; ponta do cone a ", ad_ponta_alt, " mm do fundo do soquete; topo do flange local z=", ad_flange_top));

// ---------------- Posicoes dos bicos: [x, y, angulo, raio] ----------------
function pos_bicos() = concat(
    [for (i=[0:n_interno-1]) let(a=ang0_interno + i*360/n_interno) [r_interno*cos(a), r_interno*sin(a), a, r_interno]],
    [for (i=[0:n_externo-1]) let(a=ang0_externo + i*360/n_externo) [r_externo*cos(a), r_externo*sin(a), a, r_externo]]
);

// ---------------- Modulos: cabecote ----------------
module gota2d(d) {
    r = d/2;
    circle(d=d, $fn=fn_p);
    polygon([[-r/sqrt(2), -r/sqrt(2)], [r/sqrt(2), -r/sqrt(2)], [0, -r*sqrt(2)]]);
}
module canal_radial(a, len) {
    rotate([0,0,a]) translate([0,0,canal_z])
        rotate([90,0,90]) linear_extrude(height=len) gota2d(canal_d);
}
module furo_femea(p) {
    translate([p[0], p[1], 0]) {
        translate([0,0,encaixe_h - 1])
            cylinder(d=furo_femea_d, h=1 + furo_femea_h, $fn=fn_p);
        translate([0,0,encaixe_h - furo_femea_cham])
            cylinder(d1=furo_femea_d + 4*furo_femea_cham, d2=furo_femea_d, h=2*furo_femea_cham, $fn=fn_p);
        translate([0,0,encaixe_h + espiga_bico_h])
            cylinder(d=furo_bico_d, h=canal_z - (encaixe_h + espiga_bico_h), $fn=fn_p);
    }
}

// perfil (r,z) do soquete conico 1:5 com a boca em z_top
function perfil_soquete(z_top) = [
    [0, z_top - soq_prof],
    [soq_fundo_d/2, z_top - soq_prof],
    [soq_boca_d/2 - soq_cham*0.1 , z_top - soq_cham],   // raio do cone logo abaixo do chanfro
    [soq_boca_d/2 - soq_cham*0.1 + soq_cham, z_top],   // chanfro 45 graus
    [soq_boca_d/2 - soq_cham*0.1 + soq_cham + eps, z_top + eps],
    [0, z_top + eps]
];
module soquete(z_top) { rotate_extrude($fn=fn_a) polygon(perfil_soquete(z_top)); }

// camara central: fundo em cone 45 graus, cilindro, funil 45 graus ate o soquete
module camara_funil() {
    rotate_extrude($fn=fn_g)
        polygon([
            [0, camara_apice_z],
            [camara_r, camara_apice_z + camara_r],
            [camara_r, funil_z0],
            [soq_fundo_d/2, soq_fundo_z],
            [soq_fundo_d/2, soq_fundo_z + 0.5],
            [0, soq_fundo_z + 0.5]
        ]);
}

module cabecote_uso() {
    P = pos_bicos();
    difference() {
        difference() {
            cylinder(d=corpo_d, h=topo_z, $fn=fn_g);
            translate([0,0,-1]) cylinder(d=encaixe_d, h=encaixe_h+1, $fn=fn_g);
        }
        for (p=P) furo_femea(p);
        for (p=P) canal_radial(p[2], p[3]);
        camara_funil();
        soquete(topo_z);
    }
}

// impressao: gira 180 graus em X, face superior plana (soquete) na mesa, furos para cima
module cabecote_impressao() {
    translate([0,0,topo_z]) rotate([180,0,0]) cabecote_uso();
}

// ---------------- Bico ----------------
// impressao: espiga para baixo; plano de assento em z=espiga_bico_h; ponta em z=espiga_bico_h+L
module bico() {
    sh = espiga_bico_h;
    fl = (bico_alarga_d - espiga_bico_d)/2;
    difference() {
        rotate_extrude($fn=fn_p)
            polygon([
                [0, 0],
                [espiga_bico_d/2 - bico_cham_base, 0],
                [espiga_bico_d/2, bico_cham_base],
                [espiga_bico_d/2, sh - fl],
                [bico_alarga_d/2, sh],
                [bico_base_d/2, sh],
                [bico_base_d/2, sh + bico_assento_h],
                [bico_ponta_d/2, sh + L],
                [0, sh + L]
            ]);
        translate([0,0,-1]) cylinder(d=furo_bico_d, h=sh + L + 2, $fn=fn_p);
    }
}
module bico_uso(p) {
    translate([p[0], p[1], encaixe_h + espiga_bico_h]) rotate([180,0,0]) bico();
}

// ---------------- Anel espacador ----------------
module anel() {
    h_cone = encaixe_h + (encaixe_d - anel_id)/2;
    rotate_extrude($fn=fn_g)
        polygon([
            [corpo_d/2, 0],
            [corpo_d/2, camada],
            [espiga_d/2, camada],
            [espiga_d/2, camada + espiga_h - espiga_chanfro],
            [espiga_d/2 - espiga_chanfro, camada + espiga_h],
            [anel_id/2, camada + espiga_h],
            [anel_id/2, h_cone],
            [encaixe_d/2, encaixe_h],
            [encaixe_d/2, 0]
        ]);
}

// ---------------- Adaptadores ----------------
// Orientacao de impressao = uso: ponta do cone em z=0 (na mesa), soquete para cima.
// tipo: "luer" | "cateter" | "grosso"
module adaptador(tipo) {
    // [raio do corpo, altura do corpo, boca, fundo, profundidade, furo]
    cfg = tipo == "luer"    ? [luer_cubo_d/2, luer_cubo_h, luer_boca_d, luer_fundo_d, luer_prof, luer_furo_d] :
          tipo == "cateter" ? [cat_corpo_d/2, cat_corpo_h, cat_boca_d, cat_fundo_d, cat_prof, cat_furo_d] :
                              [gro_corpo_d/2, gro_corpo_h, gro_boca_d, gro_fundo_d, gro_prof, gro_furo_d];
    br = cfg[0];  bh = cfg[1];
    top = ad_flange_top + bh;
    rtip = ad_d(ad_ponta_z)/2;
    rfl  = ad_d(ad_flange_z)/2;
    fr = flange_d/2;
    outer = concat(
        [[0, 0], [rtip, 0], [rfl, ad_cone_len], [fr, ad_cone_len + ad_cham_h]],
        (br >= fr) ? [[fr, top]] : [[fr, ad_flange_top], [br, ad_flange_top], [br, top]],
        [[0, top]]);
    bore = cfg[5];
    fz = top - cfg[4] - (cfg[3] - bore)/2;      // inicio do funil 45 graus (boca do furo)
    cavity = [
        [0, -1], [bore/2, -1], [bore/2, fz],
        [cfg[3]/2, fz + (cfg[3]-bore)/2],        // fundo do soquete
        [cfg[2]/2, top],                         // boca
        [cfg[2]/2, top + 1], [0, top + 1]
    ];
    difference() {
        rotate_extrude($fn=fn_a) polygon(outer);
        rotate_extrude($fn=fn_a) polygon(cavity);
    }
}
module adaptador_uso(tipo) { translate([0,0,ad_ponta_z]) adaptador(tipo); }

// ---------------- Pecas de teste ----------------
module teste_pote() {
    difference() {
        cylinder(d=corpo_d, h=teste_pote_h, $fn=fn_g);
        translate([0,0,-1]) cylinder(d=encaixe_d, h=teste_pote_h+2, $fn=fn_g);
    }
}
module caixa_arred(w, d, h, r) {
    hull() for (sx=[-1,1], sy=[-1,1])
        translate([sx*(w/2 - r), sy*(d/2 - r), 0]) cylinder(r=r, h=h, $fn=fn_p);
}
module teste_bloco() {
    h = teste_bloco_h;
    difference() {
        caixa_arred(teste_bloco_w, teste_bloco_d, h, teste_bloco_r);
        // (a) soquete do adaptador (mesmo cone e profundidade do cabecote)
        translate([-8, 0, 0]) soquete(h);
        // (b) furo de cola d=4.25 x 5.5 de fundo, com chanfro
        translate([teste_bloco_w/2 - 7, 0, h - furo_femea_h]) {
            cylinder(d=furo_femea_d, h=furo_femea_h + 1, $fn=fn_p);
            translate([0,0,furo_femea_h - furo_femea_cham])
                cylinder(d1=furo_femea_d, d2=furo_femea_d + 4*furo_femea_cham, h=2*furo_femea_cham, $fn=fn_p);
        }
    }
}
module teste_pino() {
    rotate_extrude($fn=fn_p)
        polygon([[0,0],[pino_d/2 - bico_cham_base, 0],[pino_d/2, bico_cham_base],[pino_d/2, pino_h],[0, pino_h]]);
}
module teste_encaixes() {
    x_b = corpo_d/2 + sep + teste_bloco_w/2;
    x_p = x_b + teste_bloco_w/2 + sep + pino_d/2;
    teste_pote();
    translate([x_b, 0, 0]) teste_bloco();
    translate([x_p, 0, 0]) teste_pino();
}

// ---------------- Placas de impressao ----------------
module placa_bicos() {
    for (i=[0:placa_cols-1], j=[0:placa_rows-1])
        translate([(i-(placa_cols-1)/2)*placa_passo, (j-(placa_rows-1)/2)*placa_passo, 0]) bico();
}
module placa_aneis() {
    p = corpo_d + sep;
    for (i=[-0.5, 0.5]) translate([i*p, 0, 0]) anel();
}
module placa_adaptadores() {
    p = flange_d + sep;
    translate([-p, 0, 0]) adaptador("luer");
    adaptador("cateter");
    translate([p, 0, 0]) adaptador("grosso");
}

// ---------------- Previews ----------------
module meio_espaco() { translate([-80, 0, -60]) cube([160, 80, 200]); }
module corte() {
    difference() { cabecote_uso(); meio_espaco(); }
    color("tomato") difference() { bico_uso(pos_bicos()[n_interno]); meio_espaco(); }
    color("gold") difference() { adaptador_uso("cateter"); meio_espaco(); }
}
module montado() {
    cabecote_uso();
    color("tomato") for (p = pos_bicos()) bico_uso(p);
    color("gold") adaptador_uso("luer");
}

// ---------------- Selecao ----------------
if      (part == "cabecote")          cabecote_impressao();
else if (part == "bico")              bico();
else if (part == "anel")              anel();
else if (part == "adaptador_luer")    adaptador("luer");
else if (part == "adaptador_cateter") adaptador("cateter");
else if (part == "adaptador_grosso")  adaptador("grosso");
else if (part == "placa_cabecote")    cabecote_impressao();
else if (part == "placa_bicos")       placa_bicos();
else if (part == "placa_aneis")       placa_aneis();
else if (part == "placa_adaptadores") placa_adaptadores();
else if (part == "teste_pote")        teste_pote();
else if (part == "teste_bloco")       teste_bloco();
else if (part == "teste_encaixes")    teste_encaixes();
else if (part == "web_cabecote")      cabecote_uso();
else if (part == "web_bico")          translate([0,0,espiga_bico_h]) rotate([180,0,0]) bico();
else if (part == "web_anel")          anel();
else if (part == "web_adaptador_luer")    adaptador_uso("luer");
else if (part == "web_adaptador_cateter") adaptador_uso("cateter");
else if (part == "web_adaptador_grosso")  adaptador_uso("grosso");
else if (part == "montado")           montado();
else if (part == "corte")             corte();
