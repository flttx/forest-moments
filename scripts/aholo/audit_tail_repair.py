"""Check source preservation, local edit scope, textures and repaired GLB structure."""
import argparse
import hashlib
import json
import struct
from collections import Counter
from audit import ROOT, audit_glb


def load(path):
    raw=path.read_bytes()
    length=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+length]),raw[28+length:]


def positions(doc,binary):
    result=set()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            accessor=doc['accessors'][primitive['attributes']['POSITION']]
            assert accessor['componentType']==5126 and accessor['type']=='VEC3'
            view=doc['bufferViews'][accessor['bufferView']]
            start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            for i in range(accessor['count']):
                point=struct.unpack_from('<fff',binary,start+i*view.get('byteStride',12))
                x,rear,height=point[0]*5,-point[2]*5,(point[1]+.3)*5
                if not (-.31<=x<=.31 and -.12<=rear<=.35 and 1.15<=height<=1.62):
                    result.add(tuple(round(v,5) for v in point))
    return result


def texture_hashes(doc,binary):
    result=[]
    for image in doc['images']:
        view=doc['bufferViews'][image['bufferView']]
        start=view.get('byteOffset',0)
        result.append(hashlib.sha256(binary[start:start+view['byteLength']]).hexdigest())
    return sorted(result)


def exterior_triangles(doc,binary):
    """Faces touching the edit box belong to the patch, including boundary vertices."""
    result=Counter()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            accessor=doc['accessors'][primitive['attributes']['POSITION']]
            view=doc['bufferViews'][accessor['bufferView']]
            start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
            points=[struct.unpack_from('<fff',binary,start+i*view.get('byteStride',12)) for i in range(accessor['count'])]
            local=[]
            for x,y,z in points:
                local.append(-.31<=x*5<=.31 and -.12<=-z*5<=.35 and 1.15<=(y+.3)*5<=1.62)
            indices=doc['accessors'][primitive['indices']]
            iv=doc['bufferViews'][indices['bufferView']]
            values=struct.unpack_from('<'+{5123:'H',5125:'I'}[indices['componentType']]*indices['count'],binary,iv.get('byteOffset',0)+indices.get('byteOffset',0))
            for i in range(0,len(values),3):
                tri=values[i:i+3]
                if not any(local[j] for j in tri):
                    signature=tuple(sorted(tuple(round(v,7) for v in points[j]) for j in tri))
                    result[signature]+=1
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--variant',default='tail-repair-v5',choices=['tail-repair-v1','tail-repair-v2','tail-repair-v3','tail-repair-v4','tail-repair-v5'])
    args=parser.parse_args()
    directory=ROOT/'assets/lux3d/round-01/raccoon-multiview'
    source=directory/'output-1.glb';output=directory/f'{args.variant}.glb'
    original=json.loads((ROOT/'docs/evidence/assets/2026-10-22-raccoon-multiview/manifest.json').read_text(encoding='utf-8'))
    expected=next(f['sha256'] for f in original['assets'][0]['files'] if 'glb' in f)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
    old,old_binary=load(source);new,new_binary=load(output)
    assert all(set(n)<= {'mesh','name','extras'} for n in new['nodes']), 'Unexpected node transform'
    old_positions=positions(old,old_binary);new_positions=positions(new,new_binary)
    source_faces=exterior_triangles(old,old_binary);output_faces=exterior_triangles(new,new_binary)
    assert texture_hashes(old,old_binary)==texture_hashes(new,new_binary)
    record={'sourceSha256':expected,'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            'sourceUnchanged':True,'embeddedTextureBytesIdentical':True,
            'unchangedRegionPositionPrecision':1e-5,'sourceUniquePositionsOutsideEditBounds':len(old_positions),
            'missingOutsidePositions':len(old_positions-new_positions),
            'addedOutsidePositions':len(new_positions-old_positions),
            'sourceExteriorTriangles':sum(source_faces.values()),
            'missingExteriorTriangles':sum((source_faces-output_faces).values()),
            'addedExteriorTriangles':sum((output_faces-source_faces).values()),
            'exteriorTriangleCoordinatePrecision':1e-7,
            'boundaryNote':'Faces touching the edit box are part of the patch; they may contain vertices just outside the box.',
            'editBoundsNormalized':{'min':[-.31,-.12,1.15],'max':[.31,.35,1.62]},
            'glb':audit_glb(output),'bytes':output.stat().st_size}
    evidence=ROOT/'docs/evidence/assets/2026-10-22-round-01/raccoon-multiview'/args.variant
    (evidence/'file-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(record))
    assert record['addedOutsidePositions']==0, 'Unexpected edit outside the tail root region'
    assert record['missingExteriorTriangles']==0 and record['addedExteriorTriangles']==0, 'Exterior source triangles changed'


if __name__=='__main__':
    main()
