import uno, json, shutil, hashlib
from pathlib import Path
ctx0=uno.getComponentContext()
resolver=ctx0.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',ctx0)
ctx=resolver.resolve('uno:socket,host=localhost,port=2017;urp;StarOffice.ComponentContext')
desktop=ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop',ctx)
def prop(n,v):
    p=uno.createUnoStruct('com.sun.star.beans.PropertyValue');p.Name=n;p.Value=v;return p
def snapshot(doc):
    result=[]
    for sheet in doc.Sheets:
        cursor=sheet.createCursor();cursor.gotoEndOfUsedArea(False)
        end=cursor.RangeAddress
        cells=sheet.getCellRangeByPosition(0,0,end.EndColumn,end.EndRow)
        result.append((sheet.Name,cells.getFormulaArray(),cells.getDataArray()))
    return result
root=Path('C:/Users/hikar/OneDrive/ドキュメント/GitHub/Clock-Attack')
source=root/'main.xlsm'
out=Path(__file__).parent/'main.ods'
if out.exists():
    raise RuntimeError('main.ods already exists; refusing to overwrite an uninspected file')
doc=desktop.loadComponentFromURL(source.as_uri(),'_blank',0,(prop('Hidden',True),prop('ReadOnly',True),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
before=snapshot(doc)
shape=doc.Sheets.getByIndex(0).DrawPage.getByIndex(0)
assert shape.Name=='btnExportAllCsv'
shape.Hyperlink=''
script='vnd.sun.star.script:Standard.Module1.ExportAllSheetsToCSV?language=Basic&location=application'
shape.Events.replaceByName('OnClick',uno.Any('[]com.sun.star.beans.PropertyValue',(prop('EventType','Script'),prop('Script',script))))
doc.storeToURL(out.as_uri(),(prop('FilterName','calc8'),prop('Overwrite',False)))
doc.close(True)
doc=desktop.loadComponentFromURL(out.as_uri(),'_blank',0,(prop('Hidden',True),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
assert snapshot(doc)==before, 'Cell content changed during conversion'
shape=doc.Sheets.getByIndex(0).DrawPage.getByIndex(0)
event={p.Name:p.Value for p in shape.Events.getByName('OnClick')}
assert event.get('Script')==script
assert shape.Hyperlink==''
print(json.dumps({'output':str(out),'sheets':list(doc.Sheets.ElementNames),'button_event':event,'cell_data_preserved':True},ensure_ascii=True))
doc.close(True)
desktop.terminate()
