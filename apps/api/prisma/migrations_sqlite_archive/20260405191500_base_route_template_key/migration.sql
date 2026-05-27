-- Add template key for fixed base routes
ALTER TABLE "routes" ADD COLUMN "template_key" TEXT;

-- Basic backfill from known route titles/origin-destination (only one row per template)
UPDATE "routes"
SET "template_key" = 'corredor-norte-indios-verdes'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Tecamac / Ojo de Agua / Ecatepec -> Indios Verdes'
      OR ("origin" = 'Tecamac / Ojo de Agua / Ecatepec' AND "destination" = 'Indios Verdes')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

UPDATE "routes"
SET "template_key" = 'corredor-oriente-pantitlan'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Nezahualcoyotl / Chimalhuacan / Chicoloapan / La Paz -> Pantitlan'
      OR ("origin" = 'Nezahualcoyotl / Chimalhuacan / Chicoloapan / La Paz' AND "destination" = 'Pantitlan')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

UPDATE "routes"
SET "template_key" = 'corredor-norponiente-cuatro-caminos'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Naucalpan / Tlalnepantla / Huixquilucan -> Cuatro Caminos / Toreo'
      OR ("origin" = 'Naucalpan / Tlalnepantla / Huixquilucan' AND "destination" = 'Cuatro Caminos / Toreo')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

UPDATE "routes"
SET "template_key" = 'corredor-suburbano-buenavista'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Cuautitlan / Tultitlan / Tlalnepantla -> Buenavista'
      OR ("origin" = 'Cuautitlan / Tultitlan / Tlalnepantla' AND "destination" = 'Buenavista')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

UPDATE "routes"
SET "template_key" = 'corredor-ecatepec-ciudad-azteca'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Ecatepec / Tecamac -> Ciudad Azteca'
      OR ("origin" = 'Ecatepec / Tecamac' AND "destination" = 'Ciudad Azteca')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

UPDATE "routes"
SET "template_key" = 'corredor-nodos-laborales-cdmx'
WHERE "id" = (
  SELECT "id" FROM "routes"
  WHERE "template_key" IS NULL
    AND (
      "title" = 'Ruta a nodos laborales CDMX'
      OR ("origin" = 'EdoMex (nodo de origen)' AND "destination" = 'Centro / zonas hospitalarias / terminales')
    )
  ORDER BY "created_at" ASC
  LIMIT 1
);

CREATE UNIQUE INDEX "routes_template_key_key" ON "routes"("template_key");
