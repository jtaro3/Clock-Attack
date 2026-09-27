import uno, json
from pathlib import Path
ctx0=uno.getComponentContext()
resolver=ctx0.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver',ctx0)
ctx=resolver.resolve('uno:socket,host=localhost,port=2017;urp;StarOffice.ComponentContext')
desktop=ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop',ctx)
def prop(n,v):
 p=uno.createUnoStruct('com.sun.star.beans.PropertyValue');p.Name=n;p.Value=v;return p
source=Path('C:/Users/hikar/OneDrive/ドキュメント/GitHub/Clock-Attack/main.xlsm')
doc=desktop.loadComponentFromURL(source.as_uri(),'_blank',0,(prop('Hidden',True),prop('ReadOnly',True),prop('MacroExecutionMode',0),prop('UpdateDocMode',0)))
print('sheets',doc.Sheets.ElementNames)
shape=doc.Sheets.getByIndex(0).DrawPage.getByIndex(0)
print('shape',shape.Name)
print('events',shape.Events.ElementNames)
print('props', [p.Name for p in shape.PropertySetInfo.Properties if any(s in p.Name.lower() for s in ['macro','hyper','click'])])
print('OnClick',shape.Events.getByName('OnClick'))
shape.Hyperlink=''
shape.Events.replaceByName('OnClick',uno.Any('[]com.sun.star.beans.PropertyValue',(prop('EventType','Script'),prop('Script','vnd.sun.star.script:Standard.Module1.ExportAllSheetsToCSV?language=Basic&location=application'))))
out=Path(__file__).parent/'repair-test.xlsm'
doc.storeToURL(out.as_uri(),(prop('FilterName','Calc MS Excel 2007 VBA XML'),prop('Overwrite',True)))
doc.close(True)
doc=desktop.loadComponentFromURL(out.as_uri(),'_blank',0,(prop('Hidden',True),prop('MacroExecutionMode',0)))
shape=doc.Sheets.getByIndex(0).DrawPage.getByIndex(0)
print('reloaded event',shape.Events.getByName('OnClick'))
print('reloaded hyperlink',shape.Hyperlink)
doc.close(True)
