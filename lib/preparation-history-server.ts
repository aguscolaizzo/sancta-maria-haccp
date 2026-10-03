import {db} from './server';
import type {PreparationKind,PreviousPreparation} from './preparation-history';

const historySql=`SELECT p.id,'classic' AS kind,p.product_name AS name,p.product_name AS short_name,p.lot_code AS reference,'/preparations/'||p.id AS href,p.prepared_at,p.expires_at,p.process_type AS operation,p.storage_mode,p.storage_temperature,p.lifecycle_status AS status,p.quantity,p.supplier_name,p.supplier_lot,p.supplier_deadline,p.received_at,p.revision,p.control_status,p.operator_initials,p.created_by_name,p.lifecycle_updated_at,p.lifecycle_updated_by_name,1 AS label_count,
 COALESCE((SELECT SUM(e.copies) FROM label_print_events e WHERE e.owner_id=p.owner_id AND e.preparation_label_id=p.id),0) AS printed_count,0 AS error_count,
 COALESCE((SELECT group_concat(x.supplier_lot_id) FROM preparation_source_lots x WHERE x.owner_id=p.owner_id AND x.preparation_label_id=p.id),'') AS source_lot_ids FROM preparation_labels p WHERE p.owner_id=? AND p.deleted_at IS NULL
 UNION ALL SELECT p.id,'quick',p.ingredient_name,p.short_name,p.preparation_code,'/t/'||(SELECT MIN(l.short_token) FROM physical_labels l WHERE l.owner_id=p.owner_id AND l.preparation_id=p.id),p.prepared_at,p.expires_at,p.operation_type,p.storage_mode,p.storage_temperature,p.status,CAST(p.bac_count AS TEXT)||' bac(s)',
 COALESCE((SELECT group_concat(DISTINCT s.name) FROM internal_preparation_source_lots x JOIN supplier_lots sl ON sl.owner_id=x.owner_id AND sl.id=x.supplier_lot_id JOIN suppliers s ON s.owner_id=sl.owner_id AND s.id=sl.supplier_id WHERE x.owner_id=p.owner_id AND x.preparation_id=p.id),''),
 COALESCE((SELECT group_concat(sl.supplier_lot,', ') FROM internal_preparation_source_lots x JOIN supplier_lots sl ON sl.owner_id=x.owner_id AND sl.id=x.supplier_lot_id WHERE x.owner_id=p.owner_id AND x.preparation_id=p.id),NULLIF(p.manual_source_lot,''),''),NULL,NULL,p.revision,'not_applicable',p.operator_initials,p.created_by_name,p.updated_at,p.updated_by_name,p.label_count,
 COALESCE((SELECT SUM(CASE WHEN l.status='printed' THEN 1 ELSE 0 END) FROM physical_labels l WHERE l.owner_id=p.owner_id AND l.preparation_id=p.id),0),
 COALESCE((SELECT SUM(CASE WHEN l.status='print_error' THEN 1 ELSE 0 END) FROM physical_labels l WHERE l.owner_id=p.owner_id AND l.preparation_id=p.id),0),
 COALESCE((SELECT group_concat(x.supplier_lot_id) FROM internal_preparation_source_lots x WHERE x.owner_id=p.owner_id AND x.preparation_id=p.id),'') FROM internal_preparations p WHERE p.owner_id=? AND p.deleted_at IS NULL`;

function map(r:Record<string,unknown>):PreviousPreparation{
 const s=(k:string)=>String(r[k]??'');
 return {
  id:s('id'),kind:s('kind') as PreparationKind,name:s('name'),shortName:s('short_name'),reference:s('reference'),href:s('href'),
  preparedAt:s('prepared_at'),expiresAt:s('expires_at'),operation:s('operation'),storageMode:s('storage_mode'),
  storageTemperature:r.storage_temperature===null||r.storage_temperature===undefined?null:Number(r.storage_temperature),status:s('status'),quantity:s('quantity'),
  supplierName:s('supplier_name'),supplierLot:s('supplier_lot'),supplierDeadline:s('supplier_deadline'),receivedAt:s('received_at'),revision:Number(r.revision),
  sourceLotIds:s('source_lot_ids').split(',').filter(Boolean),controlStatus:s('control_status'),operatorInitials:s('operator_initials'),createdByName:s('created_by_name'),
  lifecycleUpdatedAt:s('lifecycle_updated_at'),lifecycleUpdatedByName:s('lifecycle_updated_by_name'),labelCount:Number(r.label_count??1),printedCount:Number(r.printed_count??0),errorCount:Number(r.error_count??0),
 };
}
export async function findPrevious(ownerId:string,kind:PreparationKind,id:string){const r=await db().prepare(`SELECT * FROM (${historySql}) WHERE kind=? AND id=?`).bind(ownerId,ownerId,kind,id).first<Record<string,unknown>>();return r?map(r):null;}
export async function searchPrevious(ownerId:string,query:string){const q=`%${query.replace(/[\\%_]/g,c=>`\\${c}`)}%`;const rows=await db().prepare(`SELECT * FROM (${historySql}) WHERE name LIKE ? ESCAPE '\\' OR reference LIKE ? ESCAPE '\\' OR operator_initials LIKE ? ESCAPE '\\' OR status LIKE ? ESCAPE '\\' ORDER BY prepared_at DESC LIMIT 500`).bind(ownerId,ownerId,q,q,q,q).all<Record<string,unknown>>();return rows.results.map(map);}
export async function lineageFor(ownerId:string,kind:PreparationKind,id:string){const rows=await db().prepare(`SELECT x.*,p.product_name AS target_name,p.lot_code AS target_reference,p.expires_at AS target_expires_at FROM preparation_lineage x JOIN preparation_labels p ON p.owner_id=x.owner_id AND p.id=x.target_label_id WHERE x.owner_id=? AND ((x.source_kind=? AND x.source_id=?) OR (?='classic' AND x.target_label_id=?)) ORDER BY x.created_at`).bind(ownerId,kind,id,kind,id).all<Record<string,unknown>>();return rows.results;}
