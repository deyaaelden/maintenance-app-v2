import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const C={primary:'#1e3a5f',accent:'#0ea5e9',green:'#10b981',red:'#ef4444',yellow:'#f59e0b',gray:'#64748b',purple:'#8b5cf6'};
const card={backgroundColor:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.07)'};
const bS=(bg=C.primary,fg='#fff')=>({backgroundColor:bg,color:fg,border:'none',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:13,display:'inline-flex',alignItems:'center',gap:5,whiteSpace:'nowrap',fontFamily:'Tahoma,Arial,sans-serif'});
const bdg=c=>({display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:11,backgroundColor:c+'22',color:c,fontWeight:'600'});
const ovl={position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16};
const iS=dir=>({width:'100%',padding:'8px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'Tahoma,Arial,sans-serif',direction:dir});
const lbl={fontSize:12,color:'#64748b',marginBottom:4,display:'block',fontWeight:'600'};
const thS=dir=>({padding:'10px 14px',fontSize:12,color:'#64748b',fontWeight:'600',borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap',textAlign:dir==='rtl'?'right':'left'});
const tdS={padding:'10px 14px',fontSize:13,color:'#334155',borderBottom:'1px solid #f1f5f9'};
const TODAY=new Date();
const fmtD=d=>new Date(d).toISOString().split('T')[0];
const addD=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
const subD=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()-n);return r;};
const diffDays=a=>Math.ceil((new Date(a)-TODAY)/86400000);
let nid=200; const gid=()=>++nid;
const SS={upcoming:C.accent,overdue:C.red,done:C.green};
const SC={working:C.green,maint:C.yellow,broken:C.red};
const waNum=p=>(p||'').replace(/^0/,'966');
const calcNext=(date,freq,cNum,cUnit)=>{
 const d=new Date(date);const n=parseInt(cNum)||1;
 if(freq==='daily')d.setDate(d.getDate()+1);
 else if(freq==='weekly')d.setDate(d.getDate()+7);
 else if(freq==='monthly')d.setMonth(d.getMonth()+1);
 else if(freq==='quarterly')d.setMonth(d.getMonth()+3);
 else if(freq==='biannual')d.setMonth(d.getMonth()+6);
 else if(freq==='annual')d.setFullYear(d.getFullYear()+1);
 else if(freq==='custom'){
  if(cUnit==='d')d.setDate(d.getDate()+n);
  else if(cUnit==='w')d.setDate(d.getDate()+n*7);
  else if(cUnit==='m')d.setMonth(d.getMonth()+n);
  else if(cUnit==='y')d.setFullYear(d.getFullYear()+n);
 }
 return fmtD(d);
};

// ── CLOUDINARY (تخزين ومزامنة الملفات بين الأجهزة) ────
// ضع بيانات حسابك المجاني من cloudinary.com هنا:
const CLOUDINARY_CLOUD_NAME = 'dxnjwgnqe';   // مثال: 'dabc123xy'
const CLOUDINARY_UPLOAD_PRESET = 'DE-STOR';     // مثال: 'ml_default' (Unsigned)

const cloudinaryConfigured=()=>CLOUDINARY_CLOUD_NAME!=='YOUR_CLOUD_NAME'&&CLOUDINARY_UPLOAD_PRESET!=='YOUR_PRESET';

const uploadToCloudinary=(file,onProgress)=>new Promise((resolve,reject)=>{
 const fd=new FormData();
 fd.append('file',file);
 fd.append('upload_preset',CLOUDINARY_UPLOAD_PRESET);
 fd.append('folder','maintenance-files');
 const xhr=new XMLHttpRequest();
 xhr.open('POST',`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);
 xhr.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(Math.round((e.loaded/e.total)*100));};
 xhr.onload=()=>{
  if(xhr.status>=200&&xhr.status<300){
   try{const data=JSON.parse(xhr.responseText);resolve(data);}catch(e){reject(e);}
  }else{reject(new Error('Upload failed: '+xhr.status+' '+xhr.responseText));}
 };
 xhr.onerror=()=>reject(new Error('Network error'));
 xhr.send(fd);
});

// ── INDEXED DB (احتياطي محلي عند عدم توفر الإنترنت) ───
const IDB={
 _db:null,
 async db(){
  if(this._db)return this._db;
  return new Promise((res,rej)=>{
   const r=indexedDB.open('maint_files_v1',1);
   r.onupgradeneeded=e=>e.target.result.createObjectStore('files',{keyPath:'id'});
   r.onsuccess=e=>{this._db=e.target.result;res(this._db);};
   r.onerror=e=>rej(e.target.error);
  });
 },
 async save(id,blob){
  const db=await this.db();
  return new Promise((res,rej)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put({id,blob});tx.oncomplete=res;tx.onerror=e=>rej(e.target.error);});
 },
 async get(id){
  const db=await this.db();
  return new Promise((res,rej)=>{const tx=db.transaction('files','readonly');const r=tx.objectStore('files').get(id);r.onsuccess=e=>res(e.target.result?.blob||null);r.onerror=e=>rej(e.target.error);});
 },
 async del(id){
  const db=await this.db();
  return new Promise((res,rej)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=res;tx.onerror=e=>rej(e.target.error);});
 }
};

// ── FIREBASE STORAGE (legacy - غير مستخدم حالياً) ─────
let _fbStorage=null,_fbRef=null,_fbUpload=null,_fbGetUrl=null,_fbDelete=null;

const TR={
ar:{dir:'rtl',lang:'ar',langBtn:'English',appName:'إدارة الصيانة الدورية',
 navd:'لوحة التحكم',navm:'الآلات والمعدات',navs:'جداول الصيانة',navw:'الأعمال المنجزة',navp:'الفنيون والموردون',navr:'التقارير',navset:'الإعدادات',navnotes:'الملاحظات',
 loginTitle:'تسجيل الدخول',supBtn:'دخول كمشرف',userBtn:'دخول كمستخدم',passLabel:'كلمة المرور',loginBtn:'دخول',wrongPass:'كلمة المرور خاطئة',
 supRole:'مشرف',userRole:'مستخدم',logoutBtn:'خروج',
 notifTitle:'التنبيهات',noNotif:'لا توجد تنبيهات معلقة',overdueBy:'متأخر',daysWord:'أيام',sendEmail:'📧 بريد',callPhone:'📞 اتصال',sendFax:'📠 فاكس',markNotified:'✓ تم الإخطار',notifyAfter:'إخطار بعد تأخر',daysUnit:'يوم',
 manageTypes:'⚙️ إدارة أنواع المهام',taskTypesTitle:'أنواع المهام',typeAr:'الاسم عربي',typeEn:'الاسم إنجليزي',addTypeBtn:'+ إضافة',
 bulkSched:'+ مهام متعددة',bulkTitle:'إضافة مهام صيانة متعددة',tasksList:'المهام',addTaskRow:'+ مهمة جديدة',
 lastComp:'آخر إنجاز',
 settingsTitle:'الإعدادات',changePass:'تغيير كلمة مرور المشرف',changeUserPass:'تغيير كلمة مرور المستخدم',currPass:'الكلمة الحالية',newPass:'الكلمة الجديدة',confirmPass:'تأكيد الكلمة',passChanged:'✅ تم التغيير بنجاح',passMismatch:'كلمتا المرور غير متطابقتين',passWrong:'كلمة المرور الحالية خاطئة',
 companyName:'اسم الشركة/المصنع',bgImage:'صورة خلفية التطبيق',bgOpacity:'شفافية الخلفية',chooseBg:'اختر صورة',removeBg:'إزالة الخلفية',
 bgRotation:'تدوير الخلفية',bgWidth:'عرض الخلفية',bgHeight:'طول الخلفية',bgSizeNote:'اتركه فارغاً لتغطية كاملة تلقائية',bgLocationsTitle:'أماكن ظهور الخلفية',bgLocLogin:'شاشة تسجيل الدخول',bgLocSidebarFull:'كامل القائمة الجانبية',bgLocSidebarBottom:'المساحة الفارغة أسفل القائمة',bgResetBtn:'↺ إعادة ضبط',
 faxF:'رقم الفاكس',
 totalMach:'إجمالي الآلات',upcomingT:'مهام قادمة',overdueT:'مهام متأخرة',completedW:'أعمال منجزة',inMaint:'في الصيانة',needsAttn:'يحتاج تدخل فوري',completionPct:'نسبة التنفيذ',
 overdueWarn:'⚠️ تنبيه: مهام صيانة متأخرة',upcomingSec:'مواعيد الصيانة القادمة',latestSec:'آخر الأعمال المنجزة',machStatus:'حالة الآلات والمعدات',noUpcoming:'لا توجد مهام قادمة',respons:'المسؤول',
 addMach:'+ إضافة آلة',machName:'اسم الآلة',model:'الموديل',serial:'الرقم التسلسلي',dept:'القسم',status:'الحالة',installD:'تاريخ التركيب',spareP:'قطع الغيار',actions:'إجراءات',
 machDataTab:'بيانات الماكينة',manualRef:'المرجع / دليل التشغيل',machDataNotes:'مواصفات وبيانات الماكينة',attachFile:'📎 إرفاق ملف',
 addMachTitle:'إضافة آلة جديدة',editMachTitle:'تعديل الآلة',working:'تعمل',maint:'صيانة',broken:'معطلة',
 noParts:'لا توجد قطع غيار',partName:'اسم القطعة',qty:'الكمية',supplier:'المورد',contact:'بيانات التواصل',orderM:'طريقة الطلب',addPartBtn:'+ إضافة قطعة غيار',addPartTitle:'إضافة قطعة غيار',
 phoneM:'هاتف',emailM:'بريد إلكتروني',whatsappM:'واتساب',visitM:'زيارة',
 newSched:'+ جدول صيانة',addSchedTitle:'إضافة جدول صيانة',pickMach:'اختر الآلة',pickTech:'اختر الفني',taskDesc:'وصف المهمة',taskType:'نوع المهمة',freq:'التكرار',nextDate:'الموعد القادم',assignedT:'الفني المسؤول',
 daily:'يومي',weekly:'أسبوعي',monthly:'شهري',quarterly:'ربع سنوي',biannual:'نصف سنوي',annual:'سنوي',custom:'مخصص',
 every:'كل',dUnit:'أيام',wUnit:'أسابيع',mUnit:'شهور',yUnit:'سنوات',periodNum:'العدد',periodUnit:'الوحدة',
 upcoming:'قادمة',overdue:'متأخرة',done:'منجزة',allF:'الكل',markDone:'✓ منجزة',
 logWork:'+ تسجيل عمل',logWorkTitle:'تسجيل / تعديل عمل صيانة',completedTask:'المهمة المنجزة',execDate:'تاريخ التنفيذ',techExec:'الفني المنفذ',dur:'المدة (ساعات)',notes:'ملاحظات',
 viewBtn:'👁️ عرض',detailsTitle:'تفاصيل عملية الصيانة',hrs:'ساعة',regOps:'{n} عملية مسجلة',
 internalTab:'👷 الفنيون الداخليون',externalTab:'🏢 مزودو الخدمة الخارجيون',
 addP:'+ إضافة',fullName:'الاسم الكامل',roleF:'المسمى الوظيفي',specialty:'التخصص',phoneF:'رقم الهاتف',emailF:'البريد الإلكتروني',
 internalT:'داخلي',externalT:'خارجي',addIntTitle:'إضافة فني',addExtTitle:'إضافة مزود خدمة',editIntTitle:'تعديل فني',editExtTitle:'تعديل مزود خدمة',noIntP:'لا يوجد فنيون مسجلون',noExtP:'لا يوجد مزودو خدمة مسجلون',
 totalScheds:'جداول الصيانة',totalHrs:'إجمالي ساعات الصيانة',intCount:'فنيون داخليون',extCount:'مزودو الخدمة',
 machStatusChart:'حالة الآلات',schedStatusChart:'حالة الجداول',workByMach:'أعمال حسب الآلة',workByTech:'أعمال حسب الفني',summaryTable:'ملخص الصيانة لكل آلة',
 schedCount:'جداول',compCount:'أعمال منجزة',overdueCount:'جداول متأخرة',
 printFull:'🖨️ طباعة',printScheds:'🖨️ طباعة الجداول',printWO:'🖨️ طباعة الأعمال',printMach:'🖨️ طباعة قائمة الآلات',printMachData:'🖨️ طباعة بيانات الآلة',
 printOptions:'خيارات الطباعة',printTitle:'عنوان التقرير',selectCols:'اختر الأعمدة',selectSections:'اختر الأقسام',titleAlign:'محاذاة العنوان',
 save:'💾 حفظ',cancel:'إلغاء',confirmDel:'تأكيد الحذف؟',overdueNotif:'مهام متأخرة',
 machField:'الآلة/المعدة',techField:'الفني',reportTitle:'تقرير الصيانة الدورية',reportDate:'تاريخ التقرير',
 machinesList:'قائمة الآلات',schedsList:'جداول الصيانة',woList:'سجل الأعمال المنجزة',
 regMach:'{n} آلة/معدة',daysAhead:'بعد {n} يوم',daysLate:'متأخر {n} يوم',fold:'◄ طي',
 notesTitle:'الملاحظات العامة',notesPlaceholder:'اكتب ملاحظاتك هنا...',notesSaved:'✅ تم حفظ الملاحظات',
 expandAll:'توسيع الكل',collapseAll:'طي الكل',machTasks:'{n} مهمة',printMachSched:'🖨️ طباعة مهام هذه الآلة',
 secMachines:'قسم الآلات',secSchedules:'قسم جداول الصيانة',secWorkOrders:'قسم الأعمال المنجزة',secSummary:'الملخص الإحصائي',secNotes:'الملاحظات',
 userPassSection:'كلمة مرور المستخدم',userPassNote:'يستطيع المستخدم تسجيل الأعمال المنجزة فقط',
},
en:{dir:'ltr',lang:'en',langBtn:'عربي',appName:'Maintenance Management',
 navd:'Dashboard',navm:'Machines',navs:'Schedules',navw:'Work Orders',navp:'Personnel',navr:'Reports',navset:'Settings',navnotes:'Notes',
 loginTitle:'Login',supBtn:'Login as Supervisor',userBtn:'Login as User',passLabel:'Password',loginBtn:'Login',wrongPass:'Wrong password',
 supRole:'Supervisor',userRole:'User',logoutBtn:'Logout',
 notifTitle:'Notifications',noNotif:'No pending notifications',overdueBy:'Overdue by',daysWord:'days',sendEmail:'📧 Email',callPhone:'📞 Call',sendFax:'📠 Fax',markNotified:'✓ Notified',notifyAfter:'Notify after',daysUnit:'days',
 manageTypes:'⚙️ Manage Task Types',taskTypesTitle:'Task Types',typeAr:'Name (Arabic)',typeEn:'Name (English)',addTypeBtn:'+ Add',
 bulkSched:'+ Multiple Tasks',bulkTitle:'Add Multiple Tasks',tasksList:'Tasks',addTaskRow:'+ New Task',
 lastComp:'Last Completed',
 settingsTitle:'Settings',changePass:'Change Supervisor Password',changeUserPass:'Change User Password',currPass:'Current Password',newPass:'New Password',confirmPass:'Confirm Password',passChanged:'✅ Password changed',passMismatch:"Passwords don't match",passWrong:'Wrong current password',
 companyName:'Company / Factory Name',bgImage:'App Background Image',bgOpacity:'Background Opacity',chooseBg:'Choose Image',removeBg:'Remove Background',
 bgRotation:'Background Rotation',bgWidth:'Background Width',bgHeight:'Background Height',bgSizeNote:'Leave empty for automatic full cover',bgLocationsTitle:'Where the Background Appears',bgLocLogin:'Login Screen',bgLocSidebarFull:'Full Sidebar',bgLocSidebarBottom:'Empty Space Below Menu',bgResetBtn:'↺ Reset',
 faxF:'Fax Number',
 totalMach:'Total Machines',upcomingT:'Upcoming',overdueT:'Overdue',completedW:'Completed',inMaint:'in maintenance',needsAttn:'Needs immediate attention',completionPct:'Completion Rate',
 overdueWarn:'⚠️ Warning: Overdue Tasks',upcomingSec:'Upcoming Maintenance',latestSec:'Latest Completed',machStatus:'Machine Status',noUpcoming:'No upcoming tasks',respons:'Responsible',
 addMach:'+ Add Machine',machName:'Machine Name',model:'Model',serial:'Serial No.',dept:'Department',status:'Status',installD:'Install Date',spareP:'Spare Parts',actions:'Actions',
 machDataTab:'Machine Data',manualRef:'Reference / Manual',machDataNotes:'Machine Specs & Data',attachFile:'📎 Attach File',
 addMachTitle:'Add New Machine',editMachTitle:'Edit Machine',working:'Working',maint:'Maintenance',broken:'Broken',
 noParts:'No spare parts',partName:'Part Name',qty:'Quantity',supplier:'Supplier',contact:'Contact Info',orderM:'Order Method',addPartBtn:'+ Add Part',addPartTitle:'Add Spare Part',
 phoneM:'Phone',emailM:'Email',whatsappM:'WhatsApp',visitM:'Visit',
 newSched:'+ New Schedule',addSchedTitle:'Add Schedule',pickMach:'Select Machine',pickTech:'Select Technician',taskDesc:'Task Description',taskType:'Task Type',freq:'Frequency',nextDate:'Next Date',assignedT:'Assigned Technician',
 daily:'Daily',weekly:'Weekly',monthly:'Monthly',quarterly:'Quarterly',biannual:'Bi-annual',annual:'Annual',custom:'Custom',
 every:'Every',dUnit:'days',wUnit:'weeks',mUnit:'months',yUnit:'years',periodNum:'Count',periodUnit:'Unit',
 upcoming:'Upcoming',overdue:'Overdue',done:'Completed',allF:'All',markDone:'✓ Mark Done',
 logWork:'+ Log Work',logWorkTitle:'Log / Edit Work Order',completedTask:'Completed Task',execDate:'Execution Date',techExec:'Technician',dur:'Duration (hrs)',notes:'Notes',
 viewBtn:'👁️ View',detailsTitle:'Work Order Details',hrs:'hrs',regOps:'{n} work orders',
 internalTab:'👷 Internal Technicians',externalTab:'🏢 External Vendors',
 addP:'+ Add',fullName:'Full Name',roleF:'Job Title',specialty:'Specialty',phoneF:'Phone',emailF:'Email',
 internalT:'Internal',externalT:'External',addIntTitle:'Add Technician',addExtTitle:'Add Vendor',editIntTitle:'Edit Technician',editExtTitle:'Edit Vendor',noIntP:'No technicians registered',noExtP:'No vendors registered',
 totalScheds:'Schedules',totalHrs:'Total Hours',intCount:'Technicians',extCount:'Vendors',
 machStatusChart:'Machine Status',schedStatusChart:'Schedule Status',workByMach:'Work by Machine',workByTech:'Work by Technician',summaryTable:'Maintenance Summary',
 schedCount:'Schedules',compCount:'Completed',overdueCount:'Overdue',
 printFull:'🖨️ Print',printScheds:'🖨️ Print Schedules',printWO:'🖨️ Print Work Orders',printMach:'🖨️ Print Machines',printMachData:'🖨️ Print Machine Data',
 printOptions:'Print Options',printTitle:'Report Title',selectCols:'Select Columns',selectSections:'Select Sections',titleAlign:'Title Alignment',
 save:'💾 Save',cancel:'Cancel',confirmDel:'Confirm delete?',overdueNotif:'overdue tasks',
 machField:'Machine',techField:'Technician',reportTitle:'Maintenance Report',reportDate:'Report Date',
 machinesList:'Machines List',schedsList:'Maintenance Schedules',woList:'Work Orders',
 regMach:'{n} machines',daysAhead:'in {n} days',daysLate:'{n} days overdue',fold:'◄ Collapse',
 notesTitle:'General Notes',notesPlaceholder:'Write your notes here...',notesSaved:'✅ Notes saved',
 expandAll:'Expand All',collapseAll:'Collapse All',machTasks:'{n} tasks',printMachSched:'🖨️ Print This Machine',
 secMachines:'Machines Section',secSchedules:'Schedules Section',secWorkOrders:'Work Orders Section',secSummary:'Summary Statistics',secNotes:'Notes',
 userPassSection:'User Password',userPassNote:'User can only log completed work orders',
}};

const tT=(key,lang,arr)=>{const f=arr?.find(x=>x.key===key);return f?(lang==='en'?f.en:f.ar):key;};
const tStatus=(k,T)=>({working:T.working,maint:T.maint,broken:T.broken}[k]||k);
const tFreq=(k,T)=>({daily:T.daily,weekly:T.weekly,monthly:T.monthly,quarterly:T.quarterly,biannual:T.biannual,annual:T.annual,custom:T.custom}[k]||k);
const tStat=(k,T)=>({upcoming:T.upcoming,overdue:T.overdue,done:T.done}[k]||k);
const tMethod=(k,T)=>({phone:T.phoneM,email:T.emailM,whatsapp:T.whatsappM,visit:T.visitM}[k]||k);
const sBadge=s=>({working:'g',maint:'y',broken:'r',upcoming:'b',overdue:'r',done:'g'}[s]||'b');
const unitMap=lang=>({d:lang==='ar'?'أيام':'days',w:lang==='ar'?'أسابيع':'weeks',m:lang==='ar'?'شهور':'months',y:lang==='ar'?'سنوات':'years'});
const displayFreq=(s,T)=>{if(s.freq==='custom'){const u=unitMap(T.lang);return(T.every||'Every')+' '+(s.customFreqNum||1)+' '+(u[s.customFreqUnit]||'');}return tFreq(s.freq,T);};

// ── BACKGROUND IMAGE HELPERS (تدوير/حجم/أماكن ظهور الخلفية) ──
const DEFAULT_BG_LOCATIONS={login:true,sidebarFull:true,sidebarBottom:false};
const bgShownAt=(settings,key)=>{
 if(!settings?.bgImage)return false;
 const loc=settings.bgLocations||DEFAULT_BG_LOCATIONS;
 return key in loc?!!loc[key]:!!DEFAULT_BG_LOCATIONS[key];
};
// دالة موحّدة تحسب ستايل طبقة الخلفية (الحجم/الشفافية) بناءً على إعدادات المستخدم
const bgLayerStyle=(settings,extra={})=>({
 position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',
 ...extra
});
// الطبقة الداخلية التي تحمل الصورة فعلياً (منفصلة لتفادي قصّ الزوايا عند التدوير)
const bgImageLayerStyle=settings=>{
 const w=parseFloat(settings.bgWidth);
 const h=parseFloat(settings.bgHeight);
 const bgSize=(w>0||h>0)?`${w>0?w+'%':'auto'} ${h>0?h+'%':'auto'}`:'cover';
 const rot=parseFloat(settings.bgRotation)||0;
 return {
  position:'absolute',inset:0,
  backgroundImage:`url(${settings.bgImage})`,
  backgroundSize:bgSize,
  backgroundPosition:'center',
  backgroundRepeat:'no-repeat',
  opacity:settings.bgOpacity||0.1,
  transform:rot?`rotate(${rot}deg) scale(1.3)`:undefined,
  transformOrigin:'center center'
 };
};
// مكوّن جاهز لعرض طبقة الخلفية في أي حاوية (يحترم اختيار الأماكن)
const BgLayer=({settings,locationKey,zIndex=0})=>{
 if(!bgShownAt(settings,locationKey))return null;
 return <div style={bgLayerStyle(settings,{zIndex})}><div style={bgImageLayerStyle(settings)}/></div>;
};

// ── PRINT ─────────────────────────────────────────────
const doPrint=(html,T,title,hAlign)=>{
 const win=window.open('','_blank','width=1100,height=800');if(!win)return;
 const a=T.dir==='rtl'?'right':'left';const ta=hAlign||a;
 win.document.write(`<!DOCTYPE html><html dir="${T.dir}"><head><meta charset="UTF-8"><title>${title||''}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tahoma,Arial,sans-serif;direction:${T.dir};padding:28px;font-size:13px;color:#1e293b}
.hdr{display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #1e3a5f}
.hdr-title{color:#1e3a5f;text-align:${ta};white-space:pre-wrap;font-size:18px;font-weight:bold}
.hdr .sub{font-size:11px;color:#64748b;margin-top:4px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat{border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;border-top:3px solid #1e3a5f}
.sv{font-size:22px;font-weight:bold;color:#1e3a5f}.sl{font-size:11px;color:#64748b;margin-top:4px}
.sec{margin-bottom:26px}.sec-t{font-size:13px;font-weight:bold;color:#fff;background:#1e3a5f;padding:7px 14px;border-radius:6px;margin-bottom:10px;display:inline-block}
.mach-hdr{font-size:14px;font-weight:bold;color:#1e3a5f;padding:8px 14px;background:#f0f9ff;border-right:4px solid #0ea5e9;margin-bottom:8px;margin-top:16px;border-radius:4px}
table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:8px 12px;text-align:${a};font-size:12px}
td{padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.g{background:#dcfce7;color:#10b981}.r{background:#fee2e2;color:#ef4444}.y{background:#fef3c7;color:#f59e0b}.b{background:#e0f2fe;color:#0ea5e9}
.notes-box{border:1px solid #e2e8f0;border-radius:8px;padding:16px;min-height:60px;white-space:pre-wrap}
.ftr{margin-top:24px;text-align:center;padding-top:14px;border-top:1px solid #e2e8f0}
.ftr button{padding:9px 22px;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Tahoma,Arial;margin:0 5px}
.pb{background:#1e3a5f;color:#fff}.cb{background:#e2e8f0;color:#334155}
@media print{.ftr{display:none}body{padding:12px}}</style></head><body>
${html}<div class="ftr"><button class="pb" onclick="window.print()">🖨️ ${T.dir==='rtl'?'طباعة':'Print'}</button><button class="cb" onclick="window.close()">${T.dir==='rtl'?'إغلاق':'Close'}</button></div>
</body></html>`);win.document.close();};

// ── INITIAL DATA ───────────────────────────────────────
const initTaskTypes=[];
const initMachines=[];
const initSchedules=[];
const initWorkOrders=[];
const initPersonnel=[];

// ── SHARED UI ─────────────────────────────────────────
function StatCard({icon,title,value,color,sub}){
 return <div style={{...card,borderRight:`4px solid ${color}`,display:'flex',alignItems:'center',gap:14}}>
  <div style={{width:46,height:46,borderRadius:12,backgroundColor:color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{icon}</div>
  <div><div style={{fontSize:22,fontWeight:'bold',color:C.primary,lineHeight:1}}>{value}</div><div style={{fontSize:12,color:C.gray,marginTop:3}}>{title}</div>{sub&&<div style={{fontSize:11,color,marginTop:2}}>{sub}</div>}</div>
 </div>;
}
function Modal({title,onClose,children,wide}){
 return <div style={ovl} onClick={onClose}>
  <div style={{backgroundColor:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:wide?720:540,maxHeight:'92vh',overflowY:'auto',fontFamily:'Tahoma,Arial,sans-serif'}} onClick={e=>e.stopPropagation()}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
    <h3 style={{margin:0,color:C.primary,fontSize:15}}>{title}</h3>
    <button style={bS('#f1f5f9',C.gray)} onClick={onClose}>✕</button>
   </div>{children}</div></div>;
}
const FG=({l,children,full})=><div style={full?{gridColumn:'1/-1'}:{}}><label style={lbl}>{l}</label>{children}</div>;

// ── PRINT DIALOG ──────────────────────────────────────
function PrintDialog({T,defaultTitle,sections,cols,onPrint,onClose}){
 const [title,setTitle]=useState(defaultTitle||'');
 const [align,setAlign]=useState(T.dir==='rtl'?'right':'left');
 const [selSec,setSelSec]=useState(sections?sections.reduce((a,s)=>({...a,[s.key]:true}),{}):{});
 const [selCols,setSelCols]=useState(cols?cols.reduce((a,c)=>({...a,[c.key]:true}),{}):{});
 return <Modal title={T.printOptions} onClose={onClose}>
  <div style={{display:'flex',flexDirection:'column',gap:16}}>
   <div>
    <label style={lbl}>{T.printTitle}</label>
    <textarea style={{...iS(T.dir),height:90,resize:'vertical',textAlign:align}} value={title} onChange={e=>setTitle(e.target.value)} placeholder={defaultTitle}/>
    <div style={{display:'flex',gap:6,marginTop:8,alignItems:'center',flexWrap:'wrap'}}>
     <span style={{fontSize:12,color:C.gray,fontWeight:'600'}}>{T.titleAlign}:</span>
     {[['right','← يمين'],['center','↔ وسط'],['left','يسار →']].map(([a,lv])=>(
      <button key={a} style={{...bS(align===a?C.primary:'#f1f5f9',align===a?'#fff':C.gray),fontSize:12,padding:'5px 12px'}} onClick={()=>setAlign(a)}>{lv}</button>
     ))}
    </div>
   </div>
   {sections&&sections.length>0&&<div>
    <label style={lbl}>{T.selectSections}</label>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
     {sections.map(s=><label key={s.key} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,padding:'6px 12px',backgroundColor:selSec[s.key]?C.primary+'15':'#f8fafc',borderRadius:8,border:`1px solid ${selSec[s.key]?C.primary+'44':'#e2e8f0'}`}}>
      <input type="checkbox" checked={!!selSec[s.key]} onChange={e=>setSelSec(p=>({...p,[s.key]:e.target.checked}))}/> {s.label}
     </label>)}
    </div>
   </div>}
   {cols&&cols.length>0&&<div>
    <label style={lbl}>{T.selectCols}</label>
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
     {cols.map(c=><label key={c.key} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,padding:'6px 12px',backgroundColor:selCols[c.key]?C.accent+'15':'#f8fafc',borderRadius:8,border:`1px solid ${selCols[c.key]?C.accent+'44':'#e2e8f0'}`}}>
      <input type="checkbox" checked={!!selCols[c.key]} onChange={e=>setSelCols(p=>({...p,[c.key]:e.target.checked}))}/> {c.label}
     </label>)}
    </div>
   </div>}
   <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
    <button style={bS('#f1f5f9',C.gray)} onClick={onClose}>{T.cancel}</button>
    <button style={bS(C.primary)} onClick={()=>onPrint(title||defaultTitle,selSec,selCols,align)}>🖨️ {T.printOptions}</button>
   </div>
  </div>
 </Modal>;
}

// ── LOGIN SCREEN (كلا الدورين يحتاجان كلمة مرور) ──────
function LoginScreen({T,onLogin,supervisorPass,userPass,settings}){
 const [mode,setMode]=useState('choose');
 const [pass,setPass]=useState('');
 const [err,setErr]=useState(false);
 const tryLogin=()=>{
  if(mode==='sup'&&pass===supervisorPass){onLogin('supervisor');}
  else if(mode==='user'&&pass===userPass){onLogin('user');}
  else{setErr(true);}
 };
 return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Tahoma,Arial,sans-serif',direction:T.dir,position:'relative',overflow:'hidden',backgroundColor:'#f1f5f9'}}>
  <BgLayer settings={settings} locationKey="login"/>
  <div style={{backgroundColor:'rgba(255,255,255,0.97)',borderRadius:20,padding:40,width:400,boxShadow:'0 8px 30px rgba(0,0,0,0.15)',textAlign:'center',position:'relative'}}>
   <div style={{fontSize:56,marginBottom:12}}>🏭</div>
   <h2 style={{color:C.primary,fontSize:20,marginBottom:4}}>{T.appName}</h2>
   <p style={{color:C.gray,fontSize:13,marginBottom:28}}>{settings.companyName||''}</p>
   {mode==='choose'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
    <button style={{...bS(C.primary),width:'100%',justifyContent:'center',padding:'13px',fontSize:14}} onClick={()=>{setMode('sup');setErr(false);setPass('');}}>
     👑 {T.supBtn}
    </button>
    <button style={{...bS(C.accent),width:'100%',justifyContent:'center',padding:'13px',fontSize:14}} onClick={()=>{setMode('user');setErr(false);setPass('');}}>
     👷 {T.userBtn}
    </button>
   </div>}
   {mode!=='choose'&&<div>
    <div style={{marginBottom:14,padding:'8px 14px',backgroundColor:mode==='sup'?C.primary+'15':C.accent+'15',borderRadius:8,fontSize:13,color:mode==='sup'?C.primary:C.accent,fontWeight:'600'}}>
     {mode==='sup'?('👑 '+T.supRole):('👷 '+T.userRole)}
    </div>
    <label style={{...lbl,textAlign:T.dir==='rtl'?'right':'left'}}>{T.passLabel}</label>
    <input style={{...iS(T.dir),marginBottom:10,padding:'10px 14px',fontSize:14}} type="password" value={pass} autoFocus
     placeholder="••••••••"
     onChange={e=>{setPass(e.target.value);setErr(false);}}
     onKeyDown={e=>e.key==='Enter'&&tryLogin()}/>
    {err&&<div style={{color:C.red,fontSize:12,marginBottom:10,padding:'6px 10px',backgroundColor:'#fee2e2',borderRadius:6}}>❌ {T.wrongPass}</div>}
    <button style={{...bS(mode==='sup'?C.primary:C.accent),width:'100%',justifyContent:'center',padding:'11px',fontSize:14,marginBottom:10}} onClick={tryLogin}>{T.loginBtn}</button>
    <button style={{...bS('#f1f5f9',C.gray),width:'100%',justifyContent:'center',padding:'9px',fontSize:13}} onClick={()=>{setMode('choose');setPass('');setErr(false);}}>← {T.cancel}</button>
   </div>}
  </div>
 </div>;
}

// ── NOTIFICATIONS ─────────────────────────────────────
function NotificationsPanel({schedules,setSchedules,personnel,T,onClose}){
 const alerts=schedules.filter(s=>s.status==='overdue'&&!s.notified&&Math.abs(diffDays(s.nextDate))>=(s.notifyAfterDays||3));
 const getTech=id=>personnel.find(p=>p.id===id);
 const markNotified=id=>setSchedules(p=>p.map(s=>s.id===id?{...s,notified:true}:s));
 return <Modal title={'🔔 '+T.notifTitle+' ('+alerts.length+')'} onClose={onClose} wide>
  {alerts.length===0?<div style={{textAlign:'center',padding:30,color:C.gray}}>✅ {T.noNotif}</div>:alerts.map(s=>{
   const t=getTech(s.assignedId);const d=Math.abs(diffDays(s.nextDate));
   const msg=T.lang==='ar'?'عزيزي '+(t?.name||'')+' ، المهمة "'+s.task+'" للآلة "'+s.machineName+'" متأخرة '+d+' '+T.daysWord+'.'
    :'Dear '+(t?.name||'')+', task "'+s.task+'" for "'+s.machineName+'" is overdue by '+d+' '+T.daysWord+'.';
   return <div key={s.id} style={{border:'1px solid '+C.red+'33',borderRadius:10,padding:14,marginBottom:12,backgroundColor:'#fff5f5'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
     <div><div style={{fontWeight:'bold',color:C.primary,fontSize:14}}>{s.machineName}</div><div style={{fontSize:13,color:'#334155',marginTop:2}}>{s.task}</div>
      <div style={{marginTop:6,display:'flex',gap:6}}><span style={bdg(C.red)}>{T.overdueBy} {d} {T.daysWord}</span></div></div>
     <button style={bS(C.green+'22',C.green)} onClick={()=>markNotified(s.id)}>{T.markNotified}</button>
    </div>
    {t&&<div style={{backgroundColor:'#fff',borderRadius:8,padding:10}}>
     <div style={{fontWeight:'600',color:C.gray,marginBottom:8,fontSize:13}}>👷 {t.name} — {t.specialty}</div>
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {t.email&&<a href={'mailto:'+t.email+'?subject='+encodeURIComponent(T.lang==='ar'?'تأخر مهمة':'Overdue Task')+'&body='+encodeURIComponent(msg)} style={{...bS(C.accent),textDecoration:'none'}}>{T.sendEmail}</a>}
      {t.phone&&<a href={'tel:'+t.phone} style={{...bS(C.green),textDecoration:'none'}}>{T.callPhone} {t.phone}</a>}
      {t.phone&&<a href={'https://wa.me/'+waNum(t.phone)+'?text='+encodeURIComponent(msg)} target="_blank" style={{...bS('#25D366'),textDecoration:'none'}}>💬 WA</a>}
      {t.fax&&<button style={bS(C.purple)} onClick={()=>{navigator.clipboard?.writeText(t.fax);alert('📠 '+t.fax);}}>{T.sendFax}</button>}
     </div>
    </div>}
   </div>;
  })}
 </Modal>;
}

// ── DASHBOARD ─────────────────────────────────────────
function Dashboard({machines,schedules,workOrders,T}){
 const overdue=schedules.filter(s=>s.status==='overdue');
 const upcoming=schedules.filter(s=>s.status==='upcoming').sort((a,b)=>new Date(a.nextDate)-new Date(b.nextDate)).slice(0,5);
 const donePct=schedules.length>0?Math.round(schedules.filter(s=>s.status==='done').length/schedules.length*100):0;
 return <div style={{display:'flex',flexDirection:'column',gap:18}}>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:14}}>
   <StatCard icon="⚙️" title={T.totalMach} value={machines.length} color={C.primary} sub={machines.filter(m=>m.status==='maint').length+' '+T.inMaint}/>
   <StatCard icon="📅" title={T.upcomingT} value={schedules.filter(s=>s.status==='upcoming').length} color={C.accent}/>
   <StatCard icon="⚠️" title={T.overdueT} value={overdue.length} color={C.red} sub={overdue.length>0?T.needsAttn:''}/>
   <StatCard icon="✅" title={T.completedW} value={workOrders.length} color={C.green}/>
   <StatCard icon="📊" title={T.completionPct} value={donePct+'%'} color={C.purple}/>
  </div>
  {overdue.length>0&&<div style={{backgroundColor:'#fee2e2',borderRadius:10,padding:'14px 18px',borderRight:'4px solid '+C.red}}>
   <div style={{fontWeight:'bold',color:C.red,marginBottom:8,fontSize:13}}>{T.overdueWarn}</div>
   {overdue.map(s=><div key={s.id} style={{fontSize:12,color:'#7f1d1d',marginBottom:4}}>• {s.machineName} — {s.task} ({s.nextDate}) — {T.respons}: {s.assignedName}</div>)}
  </div>}
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
   <div style={card}>
    <div style={{fontWeight:'bold',color:C.primary,marginBottom:14,fontSize:13}}>{T.upcomingSec}</div>
    {upcoming.length===0?<div style={{color:C.gray,fontSize:13,textAlign:'center',padding:16}}>{T.noUpcoming}</div>:upcoming.map(s=>{const d=diffDays(s.nextDate);return <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f1f5f9'}}>
     <div><div style={{fontSize:13,fontWeight:'600',color:'#1e293b'}}>{s.task}</div><div style={{fontSize:11,color:C.gray}}>{s.machineName}</div></div>
     <div><span style={bdg(d<=3?C.yellow:C.accent)}>{T.daysAhead.replace('{n}',d)}</span></div>
    </div>;})}
   </div>
   <div style={card}>
    <div style={{fontWeight:'bold',color:C.primary,marginBottom:14,fontSize:13}}>{T.latestSec}</div>
    {[...workOrders].reverse().slice(0,5).map(wo=><div key={wo.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f1f5f9'}}>
     <div><div style={{fontSize:13,fontWeight:'600',color:'#1e293b'}}>{wo.task}</div><div style={{fontSize:11,color:C.gray}}>{wo.machineName} — {wo.techName}</div></div>
     <div style={{fontSize:11,color:C.gray}}>{wo.date}</div>
    </div>)}
   </div>
  </div>
  <div style={card}>
   <div style={{fontWeight:'bold',color:C.primary,marginBottom:14,fontSize:13}}>{T.machStatus}</div>
   <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
    {machines.map(m=><div key={m.id} style={{padding:'8px 14px',borderRadius:10,backgroundColor:SC[m.status]+'18'}}>
     <div style={{fontSize:13,fontWeight:'600',color:C.primary}}>{m.name}</div>
     <span style={bdg(SC[m.status])}>{tStatus(m.status,T)}</span>
    </div>)}
   </div>
  </div>
 </div>;
}

// ── MACHINE DATA MODAL ────────────────────────────────
function MachineDataModal({machine,onClose,T,isSup,setMachines}){
 const [tab,setTab]=useState('data');
 const [machineData,setMachineData]=useState(machine.machineData||'');
 const [manualRef,setManualRef]=useState(machine.manualRef||'');
 const [files,setFiles]=useState(machine.manualFiles||[]);
 const [uploading,setUploading]=useState(false);
 const [uploadPct,setUploadPct]=useState(0);
 const fileRef=useRef();
 const saveData=()=>setMachines(p=>p.map(m=>m.id===machine.id?{...m,machineData,manualRef,manualFiles:files}:m));
 const guessType=name=>{
  const ext=(name.split('.').pop()||'').toLowerCase();
  const map={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
  return map[ext]||'application/octet-stream';
 };
 const handleFile=async e=>{
  const f=e.target.files[0];if(!f)return;
  setUploading(true);setUploadPct(0);
  const fileId='f_'+gid()+'_'+Date.now();
  const fileType=f.type||guessType(f.name);
  if(cloudinaryConfigured()){
   try{
    const data=await uploadToCloudinary(f,setUploadPct);
    setFiles(prev=>{
     const updated=[...prev,{id:fileId,name:f.name,size:f.size,type:fileType,url:data.secure_url,storagePath:data.public_id,resourceType:data.resource_type,storageType:'cloud'}];
     setMachines(p=>p.map(m=>m.id===machine.id?{...m,manualFiles:updated}:m));
     return updated;
    });
   }catch(err){
    alert((T.lang==='ar'?'فشل الرفع للسحابة، تم الحفظ محلياً فقط: ':'Cloud upload failed, saved locally only: ')+err.message);
    await IDB.save(fileId,f);
    setFiles(prev=>{
     const updated=[...prev,{id:fileId,name:f.name,size:f.size,type:fileType,storageType:'local'}];
     setMachines(p=>p.map(m=>m.id===machine.id?{...m,manualFiles:updated}:m));
     return updated;
    });
   }
  }else{
   await IDB.save(fileId,f);
   setFiles(prev=>{
    const updated=[...prev,{id:fileId,name:f.name,size:f.size,type:fileType,storageType:'local'}];
    setMachines(p=>p.map(m=>m.id===machine.id?{...m,manualFiles:updated}:m));
    return updated;
   });
   if(!cloudinaryConfigured())alert(T.lang==='ar'?'⚠️ Cloudinary غير مُفعَّل — الملف محفوظ على هذا الجهاز فقط ولن يظهر على الأجهزة الأخرى':'⚠️ Cloudinary not configured — file saved on this device only, will not sync');
  }
  setUploading(false);setUploadPct(0);
  e.target.value='';
 };
 const openFile=async f=>{
  try{
   const isViewable=/pdf|image/.test(f.type||'')||/\.(pdf|png|jpe?g|gif|webp)$/i.test(f.name);
   let url=f.url;
   if(!url){
    const blob=await IDB.get(f.id);
    if(!blob){alert(T.lang==='ar'?'الملف غير موجود على هذا الجهاز':'File not found on this device');return;}
    const typedBlob=blob.type?blob:new Blob([blob],{type:f.type||guessType(f.name)});
    url=URL.createObjectURL(typedBlob);
   }
   if(isViewable){
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();document.body.removeChild(a);
    if(!f.url)setTimeout(()=>URL.revokeObjectURL(url),120000);
   }else{
    const a=document.createElement('a');a.href=url;a.download=f.name;a.target='_blank';document.body.appendChild(a);a.click();document.body.removeChild(a);
    if(!f.url)setTimeout(()=>URL.revokeObjectURL(url),5000);
   }
  }catch(err){alert((T.lang==='ar'?'خطأ: ':'Error: ')+err.message);}
 };
 const delFile=async id=>{
  const f=files.find(x=>x.id===id);
  if(f?.storagePath&&cloudinaryConfigured()){
   // ملاحظة: حذف الملف من Cloudinary نفسه يحتاج توقيع من الخادم (Unsigned preset لا يسمح بالحذف)
   // الملف يُزال من القائمة هنا فقط؛ لإدارة كاملة استخدم لوحة تحكم Cloudinary
  }
  await IDB.del(id).catch(()=>{});
  setFiles(prev=>{
   const updated=prev.filter(x=>x.id!==id);
   setMachines(p=>p.map(m=>m.id===machine.id?{...m,manualFiles:updated}:m));
   return updated;
  });
 };
 const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB';
 const fileIcon=f=>{
  const t=f.type||'';const n=f.name||'';
  if(t.includes('pdf')||/\.pdf$/i.test(n))return'📄';
  if(t.includes('image')||/\.(png|jpe?g|gif|webp)$/i.test(n))return'🖼️';
  if(t.includes('word')||/\.docx?$/i.test(n))return'📝';
  if(t.includes('excel')||t.includes('spreadsheet')||/\.xlsx?$/i.test(n))return'📊';
  return'📎';
 };
 const printData=()=>{
  const html='<div class="hdr"><div><div class="hdr-title">🏭 '+machine.name+'</div><div class="sub">'+machine.model+' | '+machine.serial+' | '+T.reportDate+': '+new Date().toLocaleDateString()+'</div></div></div>'
   +'<div class="sec"><div class="sec-t">'+T.machDataTab+'</div><div class="notes-box">'+(machineData||'-')+'</div></div>'
   +'<div class="sec"><div class="sec-t">'+T.manualRef+'</div><div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">'+(manualRef||'-')+'</div></div>'
   +(machine.parts?.length?'<div class="sec"><div class="sec-t">'+T.spareP+'</div><table><thead><tr><th>'+T.partName+'</th><th>'+T.qty+'</th><th>'+T.supplier+'</th><th>'+T.contact+'</th></tr></thead><tbody>'+machine.parts.map(p=>'<tr><td>'+p.name+'</td><td>'+p.qty+'</td><td>'+p.supplier+'</td><td>'+p.contact+'</td></tr>').join('')+'</tbody></table></div>':'');
  doPrint(html,T,machine.name,'right');
 };
 return <Modal title={machine.name} onClose={onClose} wide>
  <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
   {[['data',T.machDataTab],['files',T.lang==='ar'?'الملفات 📂':'Files 📂'],['parts',T.spareP]].map(([k,v])=><button key={k} style={bS(tab===k?C.primary:'#f1f5f9',tab===k?'#fff':C.gray)} onClick={()=>setTab(k)}>{v}</button>)}
   <button style={{...bS('#f0fdf4',C.green),marginRight:'auto'}} onClick={printData}>{T.printMachData}</button>
  </div>
  {tab==='data'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
   <FG l={T.machDataNotes} full><textarea style={{...iS(T.dir),height:150,resize:'vertical'}} value={machineData} onChange={e=>setMachineData(e.target.value)} readOnly={!isSup}/></FG>
   <FG l={T.manualRef} full><textarea style={{...iS(T.dir),height:60,resize:'vertical'}} value={manualRef} onChange={e=>setManualRef(e.target.value)} readOnly={!isSup}/></FG>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:12,backgroundColor:'#f8fafc',borderRadius:10}}>
    {[[T.model,machine.model],[T.serial,machine.serial],[T.dept,machine.dept],[T.installD,machine.installDate]].map(([k,v])=><div key={k} style={{fontSize:13}}><b style={{color:C.gray}}>{k}:</b> {v}</div>)}
    <div style={{fontSize:13}}><b style={{color:C.gray}}>{T.status}:</b> <span style={bdg(SC[machine.status])}>{tStatus(machine.status,T)}</span></div>
   </div>
   {isSup&&<div style={{textAlign:'right'}}><button style={bS(C.green)} onClick={saveData}>{T.save}</button></div>}
  </div>}
  {tab==='files'&&<div>
   {isSup&&<div style={{marginBottom:16,padding:14,backgroundColor:'#f0f9ff',borderRadius:10,border:'1px dashed '+C.accent}}>
    <div style={{fontSize:13,color:C.primary,fontWeight:'600',marginBottom:8}}>{T.lang==='ar'?'📎 رفع ملف (PDF، صور، Word، Excel)':'📎 Upload File (PDF, Images, Word, Excel)'}</div>
    <div style={{display:'flex',gap:10,alignItems:'center'}}>
     <button style={bS(C.accent)} onClick={()=>fileRef.current?.click()} disabled={uploading}>
      {uploading?(T.lang==='ar'?`⏳ ${uploadPct}%`:`⏳ ${uploadPct}%`):'📁 '+(T.lang==='ar'?'اختر ملفاً':'Choose File')}
     </button>
     <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{display:'none'}} onChange={handleFile}/>
     <span style={{fontSize:11,color:C.gray}}>{T.lang==='ar'?'🌐 يُرفع للسحابة ويظهر فوراً على جميع الأجهزة':'🌐 Uploaded to cloud, syncs to all devices instantly'}</span>
    </div>
   </div>}
   {files.length===0?<div style={{textAlign:'center',padding:32,color:C.gray}}>
    {T.lang==='ar'?'لا توجد ملفات مرفوعة':'No files uploaded yet'}
   </div>:<div style={{display:'flex',flexDirection:'column',gap:10}}>
    {files.map(f=><div key={f.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',backgroundColor:'#f8fafc',borderRadius:10,border:'1px solid #e2e8f0'}}>
     <span style={{fontSize:26}}>{fileIcon(f)}</span>
     <div style={{flex:1}}>
      <div style={{fontWeight:'600',color:C.primary,fontSize:13}}>{f.name}</div>
      <div style={{fontSize:12,color:C.gray,marginTop:2}}>{fmtSize(f.size)}</div>
     </div>
     <div style={{display:'flex',gap:6}}>
      <button style={bS(C.accent)} onClick={()=>openFile(f)}>
       {f.type?.includes('pdf')||f.type?.includes('image')?(T.lang==='ar'?'👁️ فتح':'👁️ Open'):(T.lang==='ar'?'⬇️ تنزيل':'⬇️ Download')}
      </button>
      {isSup&&<button style={bS('#fee2e222',C.red)} onClick={()=>delFile(f.id)}>🗑️</button>}
     </div>
    </div>)}
   </div>}
   {isSup&&files.length>0&&<div style={{marginTop:14,textAlign:'right'}}><button style={bS(C.green)} onClick={saveData}>{T.save}</button></div>}
  </div>}
  {tab==='parts'&&<div>
   {(machine.parts?.length||0)===0?<div style={{textAlign:'center',padding:24,color:C.gray}}>{T.noParts}</div>:(
    <table style={{width:'100%',borderCollapse:'collapse'}}>
     <thead><tr style={{backgroundColor:'#f8fafc'}}>{[T.partName,T.qty,T.supplier,T.contact,T.orderM].map(h=><th key={h} style={thS(T.dir)}>{h}</th>)}</tr></thead>
     <tbody>{machine.parts.map((p,i)=><tr key={i}><td style={tdS}>{p.name}</td><td style={tdS}>{p.qty}</td><td style={tdS}>{p.supplier}</td><td style={tdS}>{p.contact}</td><td style={tdS}><span style={bdg(C.accent)}>{tMethod(p.method,T)}</span></td></tr>)}</tbody>
    </table>
   )}
   {isSup&&<AddPartForm machine={machine} setMachines={setMachines} T={T}/>}
  </div>}
 </Modal>;
}

function AddPartForm({machine,setMachines,T}){
 const [open,setOpen]=useState(false);
 const [f,setF]=useState({name:'',qty:'',supplier:'',contact:'',method:'phone'});
 const save=()=>{if(!f.name)return;const p={...f,id:gid()};setMachines(p2=>p2.map(m=>m.id===machine.id?{...m,parts:[...(m.parts||[]),p]}:m));setF({name:'',qty:'',supplier:'',contact:'',method:'phone'});setOpen(false);};
 if(!open)return <div style={{marginTop:14,textAlign:'center'}}><button style={bS(C.accent)} onClick={()=>setOpen(true)}>{T.addPartBtn}</button></div>;
 return <div style={{marginTop:14,padding:14,backgroundColor:'#f8fafc',borderRadius:10}}>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
   <FG l={T.partName}><input style={iS(T.dir)} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></FG>
   <FG l={T.qty}><input style={iS(T.dir)} value={f.qty} onChange={e=>setF({...f,qty:e.target.value})}/></FG>
   <FG l={T.supplier}><input style={iS(T.dir)} value={f.supplier} onChange={e=>setF({...f,supplier:e.target.value})}/></FG>
   <FG l={T.contact}><input style={iS(T.dir)} value={f.contact} onChange={e=>setF({...f,contact:e.target.value})}/></FG>
   <FG l={T.orderM}><select style={iS(T.dir)} value={f.method} onChange={e=>setF({...f,method:e.target.value})}>{['phone','email','whatsapp','visit'].map(x=><option key={x} value={x}>{tMethod(x,T)}</option>)}</select></FG>
  </div>
  <div style={{display:'flex',gap:8,marginTop:10,justifyContent:'flex-end'}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>setOpen(false)}>{T.cancel}</button><button style={bS(C.green)} onClick={save}>{T.save}</button></div>
 </div>;
}

// ── MACHINES ─────────────────────────────────────────
function Machines({machines,setMachines,T,isSup}){
 const [showM,setShowM]=useState(false);const [edit,setEdit]=useState(null);const [viewData,setViewData]=useState(null);const [showPrint,setShowPrint]=useState(false);
 const emptyF={name:'',model:'',serial:'',dept:'',status:'working',installDate:'',machineData:'',manualRef:'',parts:[],manualFiles:[]};
 const [f,setF]=useState(emptyF);
 const save=()=>{if(!f.name)return;if(edit)setMachines(p=>p.map(m=>m.id===edit?{...f,id:edit}:m));else setMachines(p=>[...p,{...f,id:gid()}]);setShowM(false);};
 const del=id=>{if(window.confirm(T.confirmDel))setMachines(p=>p.filter(m=>m.id!==id));};
 const handlePrint=(title,_,selCols,hAlign)=>{
  const allCols=[{key:'model',label:T.model},{key:'dept',label:T.dept},{key:'status',label:T.status},{key:'installDate',label:T.installD},{key:'serial',label:T.serial}];
  const cols=allCols.filter(c=>!selCols||selCols[c.key]!==false);
  const rows=machines.map(m=>'<tr><td>'+m.name+'</td>'+cols.map(c=>c.key==='status'?'<td><span class="badge '+sBadge(m.status)+'">'+tStatus(m.status,T)+'</span></td>':'<td>'+(m[c.key]||'-')+'</td>').join('')+'</tr>').join('');
  doPrint('<div class="hdr"><div><div class="hdr-title">'+(title||T.machinesList)+'</div><div class="sub">'+T.reportDate+': '+new Date().toLocaleDateString()+'</div></div></div><div class="sec"><table><thead><tr><th>'+T.machName+'</th>'+cols.map(c=>'<th>'+c.label+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>',T,title||T.machinesList,hAlign);
  setShowPrint(false);
 };
 return <div style={{display:'flex',flexDirection:'column',gap:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
   <span style={{fontSize:13,color:C.gray}}>{T.regMach.replace('{n}',machines.length)}</span>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <button style={bS('#e2e8f0',C.gray)} onClick={()=>setShowPrint(true)}>{T.printMach}</button>
    {isSup&&<button style={bS()} onClick={()=>{setF(emptyF);setEdit(null);setShowM(true);}}>{T.addMach}</button>}
   </div>
  </div>
  <div style={card}><div style={{overflowX:'auto'}}>
   <table style={{width:'100%',borderCollapse:'collapse'}}>
    <thead><tr style={{backgroundColor:'#f8fafc'}}>{[T.machName,T.model,T.dept,T.status,T.installD,T.machDataTab,T.actions].map(h=><th key={h} style={thS(T.dir)}>{h}</th>)}</tr></thead>
    <tbody>{machines.map(m=><tr key={m.id}>
     <td style={{...tdS,fontWeight:'600'}}>{m.name}</td><td style={tdS}>{m.model}</td><td style={tdS}>{m.dept}</td>
     <td style={tdS}><span style={bdg(SC[m.status])}>{tStatus(m.status,T)}</span></td>
     <td style={tdS}>{m.installDate}</td>
     <td style={tdS}><button style={bS(C.accent+'22',C.accent)} onClick={()=>setViewData(m)}>📄 {T.machDataTab}</button></td>
     <td style={tdS}><div style={{display:'flex',gap:5}}>
      {isSup&&<><button style={bS('#f1f5f9',C.gray)} onClick={()=>{setF({...m,parts:m.parts||[],manualFiles:m.manualFiles||[]});setEdit(m.id);setShowM(true);}}>✏️</button><button style={bS('#fee2e222',C.red)} onClick={()=>del(m.id)}>🗑️</button></>}
     </div></td>
    </tr>)}</tbody>
   </table>
  </div></div>
  {showM&&<Modal title={edit?T.editMachTitle:T.addMachTitle} onClose={()=>setShowM(false)}>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>
    <FG l={T.machName} full><input style={iS(T.dir)} value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></FG>
    <FG l={T.model}><input style={iS(T.dir)} value={f.model||''} onChange={e=>setF({...f,model:e.target.value})}/></FG>
    <FG l={T.serial}><input style={iS(T.dir)} value={f.serial||''} onChange={e=>setF({...f,serial:e.target.value})}/></FG>
    <FG l={T.dept}><input style={iS(T.dir)} value={f.dept||''} onChange={e=>setF({...f,dept:e.target.value})}/></FG>
    <FG l={T.installD}><input style={iS(T.dir)} type="date" value={f.installDate||''} onChange={e=>setF({...f,installDate:e.target.value})}/></FG>
    <FG l={T.status}><select style={iS(T.dir)} value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{['working','maint','broken'].map(x=><option key={x} value={x}>{tStatus(x,T)}</option>)}</select></FG>
    <FG l={T.manualRef} full><input style={iS(T.dir)} value={f.manualRef||''} onChange={e=>setF({...f,manualRef:e.target.value})}/></FG>
    <FG l={T.machDataNotes} full><textarea style={{...iS(T.dir),height:80,resize:'vertical'}} value={f.machineData||''} onChange={e=>setF({...f,machineData:e.target.value})}/></FG>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>setShowM(false)}>{T.cancel}</button><button style={bS(C.green)} onClick={save}>{T.save}</button></div>
  </Modal>}
  {viewData&&<MachineDataModal machine={viewData} onClose={()=>setViewData(null)} T={T} isSup={isSup} setMachines={setMachines}/>}
  {showPrint&&<PrintDialog T={T} defaultTitle={T.machinesList} cols={[{key:'model',label:T.model},{key:'dept',label:T.dept},{key:'status',label:T.status},{key:'installDate',label:T.installD},{key:'serial',label:T.serial}]} onPrint={handlePrint} onClose={()=>setShowPrint(false)}/>}
 </div>;
}

// ── SCHEDULES ─────────────────────────────────────────
function Schedules({schedules,setSchedules,machines,personnel,T,taskTypes,setTaskTypes,isSup}){
 const [showM,setShowM]=useState(false);const [showBulk,setShowBulk]=useState(false);const [filter,setFilter]=useState('all');const [showTypes,setShowTypes]=useState(false);const [showPrint,setShowPrint]=useState(false);const [printMachId,setPrintMachId]=useState(null);
 const [expanded,setExpanded]=useState({});
 const techs=personnel.filter(p=>p.type==='internal');
 const emptyF={machineId:'',task:'',taskType:taskTypes[0]?.key||'preventive',freq:'weekly',nextDate:'',assignedId:'',notifyAfterDays:3,customFreqNum:1,customFreqUnit:'m'};
 const [f,setF]=useState(emptyF);
 const initBulk={machineId:'',assignedId:'',freq:'weekly',nextDate:'',notifyAfterDays:3,customFreqNum:1,customFreqUnit:'m',tasks:[{id:1,task:'',taskType:taskTypes[0]?.key||'preventive'}]};
 const [bulk,setBulk]=useState(initBulk);
 const save=()=>{if(!f.task||!f.nextDate)return;const m=machines.find(x=>x.id===parseInt(f.machineId));const t=techs.find(x=>x.id===parseInt(f.assignedId));setSchedules(p=>[...p,{...f,id:gid(),machineId:parseInt(f.machineId),machineName:m?.name||'',assignedId:parseInt(f.assignedId),assignedName:t?.name||'',status:'upcoming',lastCompleted:null,notifyAfterDays:parseInt(f.notifyAfterDays)||3}]);setShowM(false);};
 const saveBulk=()=>{if(!bulk.machineId||!bulk.nextDate)return;const m=machines.find(x=>x.id===parseInt(bulk.machineId));const t=techs.find(x=>x.id===parseInt(bulk.assignedId));const newS=bulk.tasks.filter(tk=>tk.task).map(tk=>({id:gid(),machineId:parseInt(bulk.machineId),machineName:m?.name||'',task:tk.task,taskType:tk.taskType,freq:bulk.freq,nextDate:bulk.nextDate,lastCompleted:null,assignedId:parseInt(bulk.assignedId),assignedName:t?.name||'',status:'upcoming',notifyAfterDays:parseInt(bulk.notifyAfterDays)||3,customFreqNum:parseInt(bulk.customFreqNum)||1,customFreqUnit:bulk.customFreqUnit}));setSchedules(p=>[...p,...newS]);setShowBulk(false);setBulk(initBulk);};
 const del=id=>{if(window.confirm(T.confirmDel))setSchedules(p=>p.filter(x=>x.id!==id));};
 const done=s=>setSchedules(p=>p.map(x=>x.id===s.id?{...x,status:'upcoming',lastCompleted:fmtD(TODAY),nextDate:calcNext(s.nextDate,s.freq,s.customFreqNum,s.customFreqUnit)}:x));
 const filtered=filter==='all'?schedules:schedules.filter(s=>s.status===filter);
 const machineGroups=machines.map(m=>({machine:m,scheds:filtered.filter(s=>s.machineId===m.id)})).filter(g=>g.scheds.length>0);
 const toggleExpand=id=>setExpanded(p=>({...p,[id]:p[id]===false}));
 const toggleAll=exp=>setExpanded(machineGroups.reduce((a,g)=>({...a,[g.machine.id]:exp?undefined:false}),{}));
 const handlePrint=(title,_,selCols,hAlign,machineId)=>{
  const allCols=[{key:'task',label:T.taskDesc},{key:'taskType',label:T.taskType},{key:'freq',label:T.freq},{key:'nextDate',label:T.nextDate},{key:'lastComp',label:T.lastComp},{key:'assignedT',label:T.assignedT},{key:'status',label:T.status}];
  const colDefs=allCols.filter(c=>!selCols||selCols[c.key]!==false);
  const groups=machineId?machineGroups.filter(g=>g.machine.id===machineId):machineGroups;
  let body='';
  groups.forEach(g=>{body+='<div class="mach-hdr">⚙️ '+g.machine.name+'</div><table><thead><tr>'+colDefs.map(c=>'<th>'+c.label+'</th>').join('')+'</tr></thead><tbody>';
   g.scheds.forEach(s=>{body+='<tr>';colDefs.forEach(c=>{if(c.key==='task')body+='<td>'+s.task+'</td>';else if(c.key==='taskType')body+='<td>'+tT(s.taskType,T.lang,taskTypes)+'</td>';else if(c.key==='freq')body+='<td>'+displayFreq(s,T)+'</td>';else if(c.key==='nextDate')body+='<td>'+s.nextDate+'</td>';else if(c.key==='lastComp')body+='<td>'+(s.lastCompleted||'-')+'</td>';else if(c.key==='assignedT')body+='<td>'+s.assignedName+'</td>';else if(c.key==='status')body+='<td><span class="badge '+sBadge(s.status)+'">'+tStat(s.status,T)+'</span></td>';});body+='</tr>';});
   body+='</tbody></table>';});
  doPrint('<div class="hdr"><div><div class="hdr-title">'+(title||T.schedsList)+'</div><div class="sub">'+T.reportDate+': '+new Date().toLocaleDateString()+'</div></div></div><div class="sec">'+body+'</div>',T,title||T.schedsList,hAlign);
  setShowPrint(false);setPrintMachId(null);
 };
 const colOptions=[{key:'task',label:T.taskDesc},{key:'taskType',label:T.taskType},{key:'freq',label:T.freq},{key:'nextDate',label:T.nextDate},{key:'lastComp',label:T.lastComp},{key:'assignedT',label:T.assignedT},{key:'status',label:T.status}];
 const freqOptions=['daily','weekly','monthly','quarterly','biannual','annual','custom'];
 const unitOptions=[{v:'d',l:T.dUnit},{v:'w',l:T.wUnit},{v:'m',l:T.mUnit},{v:'y',l:T.yUnit}];
 return <div style={{display:'flex',flexDirection:'column',gap:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
   <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[['all',T.allF],['upcoming',T.upcoming],['overdue',T.overdue],['done',T.done]].map(([k,v])=><button key={k} style={bS(filter===k?C.primary:'#f1f5f9',filter===k?'#fff':C.gray)} onClick={()=>setFilter(k)}>{v}</button>)}</div>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <button style={bS('#e2e8f0',C.gray)} onClick={()=>setShowPrint(true)}>{T.printScheds}</button>
    {isSup&&<><button style={bS('#f0fdf4',C.green)} onClick={()=>setShowTypes(true)}>{T.manageTypes}</button><button style={bS(C.purple)} onClick={()=>setShowBulk(true)}>{T.bulkSched}</button><button style={bS()} onClick={()=>{setF(emptyF);setShowM(true);}}>{T.newSched}</button></>}
   </div>
  </div>
  <div style={{display:'flex',gap:8}}><button style={bS('#f8fafc',C.gray)} onClick={()=>toggleAll(true)}>▼ {T.expandAll}</button><button style={bS('#f8fafc',C.gray)} onClick={()=>toggleAll(false)}>▲ {T.collapseAll}</button></div>
  {machineGroups.length===0?<div style={{...card,textAlign:'center',padding:40,color:C.gray}}>—</div>:machineGroups.map(({machine:m,scheds})=>{
   const exp=expanded[m.id]!==false;
   return <div key={m.id} style={card}>
    <div onClick={()=>toggleExpand(m.id)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',marginBottom:exp?14:0,userSelect:'none'}}>
     <div style={{display:'flex',alignItems:'center',gap:10}}>
      <span style={{fontSize:18}}>⚙️</span><span style={{fontWeight:'bold',color:C.primary,fontSize:14}}>{m.name}</span>
      <span style={bdg(C.accent)}>{T.machTasks.replace('{n}',scheds.length)}</span>
      {scheds.some(s=>s.status==='overdue')&&<span style={bdg(C.red)}>⚠️</span>}
     </div>
     <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <button style={bS('#f0f9ff',C.accent)} onClick={e=>{e.stopPropagation();setPrintMachId(m.id);setShowPrint(true);}}>{T.printMachSched}</button>
      <span style={{color:C.gray,fontSize:18}}>{exp?'▲':'▼'}</span>
     </div>
    </div>
    {exp&&<div style={{overflowX:'auto'}}>
     <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr style={{backgroundColor:'#f8fafc'}}>{[T.taskDesc,T.taskType,T.freq,T.nextDate,T.lastComp,T.assignedT,T.status,T.actions].map(h=><th key={h} style={thS(T.dir)}>{h}</th>)}</tr></thead>
      <tbody>{scheds.map(s=>{const d=diffDays(s.nextDate);return <tr key={s.id}>
       <td style={tdS}>{s.task}</td><td style={tdS}><span style={bdg(C.purple)}>{tT(s.taskType,T.lang,taskTypes)}</span></td>
       <td style={tdS}><span style={bdg(C.accent)}>{displayFreq(s,T)}</span></td>
       <td style={tdS}><div>{s.nextDate}</div>{s.status!=='done'&&<div style={{fontSize:11,color:d<0?C.red:d<=3?C.yellow:C.green}}>{d<0?T.daysLate.replace('{n}',Math.abs(d)):T.daysAhead.replace('{n}',d)}</div>}</td>
       <td style={tdS}><span style={{fontSize:12,color:C.gray}}>{s.lastCompleted||'—'}</span></td>
       <td style={tdS}>{s.assignedName}</td>
       <td style={tdS}><span style={bdg(SS[s.status])}>{tStat(s.status,T)}</span></td>
       <td style={tdS}><div style={{display:'flex',gap:5}}>
        {s.status!=='done'&&<button style={bS(C.green+'22',C.green)} onClick={()=>done(s)}>{T.markDone}</button>}
        {isSup&&<button style={bS('#fee2e222',C.red)} onClick={()=>del(s.id)}>🗑️</button>}
       </div></td>
      </tr>;})}
      </tbody>
     </table>
    </div>}
   </div>;
  })}
  {showM&&<Modal title={T.addSchedTitle} onClose={()=>setShowM(false)}>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>
    <FG l={T.machField}><select style={iS(T.dir)} value={f.machineId} onChange={e=>setF({...f,machineId:e.target.value})}><option value="">{T.pickMach}</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></FG>
    <FG l={T.assignedT}><select style={iS(T.dir)} value={f.assignedId} onChange={e=>setF({...f,assignedId:e.target.value})}><option value="">{T.pickTech}</option>{techs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></FG>
    <FG l={T.taskDesc} full><input style={iS(T.dir)} value={f.task} onChange={e=>setF({...f,task:e.target.value})}/></FG>
    <FG l={T.taskType}><select style={iS(T.dir)} value={f.taskType} onChange={e=>setF({...f,taskType:e.target.value})}>{taskTypes.map(x=><option key={x.key} value={x.key}>{T.lang==='en'?x.en:x.ar}</option>)}</select></FG>
    <FG l={T.freq}><select style={iS(T.dir)} value={f.freq} onChange={e=>setF({...f,freq:e.target.value})}>{freqOptions.map(x=><option key={x} value={x}>{tFreq(x,T)}</option>)}</select></FG>
    {f.freq==='custom'&&<div style={{gridColumn:'1/-1',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:12,backgroundColor:'#f0f9ff',borderRadius:10}}>
     <FG l={T.periodNum}><input style={iS(T.dir)} type="number" min="1" value={f.customFreqNum} onChange={e=>setF({...f,customFreqNum:e.target.value})}/></FG>
     <FG l={T.periodUnit}><select style={iS(T.dir)} value={f.customFreqUnit} onChange={e=>setF({...f,customFreqUnit:e.target.value})}>{unitOptions.map(u=><option key={u.v} value={u.v}>{u.l}</option>)}</select></FG>
     <div style={{gridColumn:'1/-1',fontSize:12,color:C.accent}}>👁️ {T.every} {f.customFreqNum||1} {unitOptions.find(u=>u.v===f.customFreqUnit)?.l}</div>
    </div>}
    <FG l={T.nextDate}><input style={iS(T.dir)} type="date" value={f.nextDate} onChange={e=>setF({...f,nextDate:e.target.value})}/></FG>
    <FG l={T.notifyAfter+' ('+T.daysUnit+')'}><input style={iS(T.dir)} type="number" min="1" value={f.notifyAfterDays} onChange={e=>setF({...f,notifyAfterDays:e.target.value})}/></FG>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>setShowM(false)}>{T.cancel}</button><button style={bS(C.green)} onClick={save}>{T.save}</button></div>
  </Modal>}
  {showBulk&&<Modal title={T.bulkTitle} onClose={()=>setShowBulk(false)} wide>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,marginBottom:16}}>
    <FG l={T.machField}><select style={iS(T.dir)} value={bulk.machineId} onChange={e=>setBulk({...bulk,machineId:e.target.value})}><option value="">{T.pickMach}</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></FG>
    <FG l={T.assignedT}><select style={iS(T.dir)} value={bulk.assignedId} onChange={e=>setBulk({...bulk,assignedId:e.target.value})}><option value="">{T.pickTech}</option>{techs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></FG>
    <FG l={T.freq}><select style={iS(T.dir)} value={bulk.freq} onChange={e=>setBulk({...bulk,freq:e.target.value})}>{freqOptions.map(x=><option key={x} value={x}>{tFreq(x,T)}</option>)}</select></FG>
    {bulk.freq==='custom'&&<div style={{gridColumn:'1/-1',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,padding:10,backgroundColor:'#f0f9ff',borderRadius:10}}>
     <FG l={T.periodNum}><input style={iS(T.dir)} type="number" min="1" value={bulk.customFreqNum} onChange={e=>setBulk({...bulk,customFreqNum:e.target.value})}/></FG>
     <FG l={T.periodUnit}><select style={iS(T.dir)} value={bulk.customFreqUnit} onChange={e=>setBulk({...bulk,customFreqUnit:e.target.value})}>{unitOptions.map(u=><option key={u.v} value={u.v}>{u.l}</option>)}</select></FG>
    </div>}
    <FG l={T.nextDate}><input style={iS(T.dir)} type="date" value={bulk.nextDate} onChange={e=>setBulk({...bulk,nextDate:e.target.value})}/></FG>
    <FG l={T.notifyAfter+' ('+T.daysUnit+')'}><input style={iS(T.dir)} type="number" min="1" value={bulk.notifyAfterDays} onChange={e=>setBulk({...bulk,notifyAfterDays:e.target.value})}/></FG>
   </div>
   <div style={{fontWeight:'bold',color:C.primary,marginBottom:8,fontSize:13}}>{T.tasksList}:</div>
   <div style={{maxHeight:260,overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:10,padding:10}}>
    {bulk.tasks.map((tk,i)=><div key={tk.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,marginBottom:8,alignItems:'end'}}>
     <div><label style={lbl}>{T.taskDesc} {i+1}</label><input style={iS(T.dir)} value={tk.task} onChange={e=>setBulk(p=>({...p,tasks:p.tasks.map(t=>t.id===tk.id?{...t,task:e.target.value}:t)}))}/></div>
     <div><label style={lbl}>{T.taskType}</label><select style={{...iS(T.dir),width:'auto'}} value={tk.taskType} onChange={e=>setBulk(p=>({...p,tasks:p.tasks.map(t=>t.id===tk.id?{...t,taskType:e.target.value}:t)}))}>
      {taskTypes.map(x=><option key={x.key} value={x.key}>{T.lang==='en'?x.en:x.ar}</option>)}
     </select></div>
     {bulk.tasks.length>1&&<button style={{...bS('#fee2e222',C.red),marginTop:18}} onClick={()=>setBulk(p=>({...p,tasks:p.tasks.filter(t=>t.id!==tk.id)}))}>✕</button>}
    </div>)}
    <button style={{...bS('#f0f9ff',C.accent),width:'100%',justifyContent:'center',marginTop:4}} onClick={()=>setBulk(p=>({...p,tasks:[...p.tasks,{id:gid(),task:'',taskType:taskTypes[0]?.key||'preventive'}]}))}>{T.addTaskRow}</button>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>setShowBulk(false)}>{T.cancel}</button><button style={bS(C.purple)} onClick={saveBulk}>{T.save} ({bulk.tasks.filter(t=>t.task).length})</button></div>
  </Modal>}
  {showTypes&&<Modal title={T.manageTypes} onClose={()=>setShowTypes(false)}>
   <div style={{maxHeight:220,overflowY:'auto',marginBottom:16,border:'1px solid #e2e8f0',borderRadius:10}}>
    {taskTypes.map(t=><div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid #f1f5f9'}}>
     <span><b style={{color:C.primary}}>{t.ar}</b><span style={{color:'#cbd5e1',margin:'0 8px'}}>|</span><span style={{color:C.gray}}>{t.en}</span></span>
     <button style={bS('#fee2e222',C.red)} onClick={()=>{if(window.confirm(T.confirmDel))setTaskTypes(p=>p.filter(x=>x.id!==t.id))}}>🗑️</button>
    </div>)}
   </div>
   <AddTypeRow setTaskTypes={setTaskTypes} T={T}/>
  </Modal>}
  {showPrint&&<PrintDialog T={T} defaultTitle={printMachId?machines.find(m=>m.id===printMachId)?.name:T.schedsList} cols={colOptions} onPrint={(title,sec,cols,align)=>handlePrint(title,sec,cols,align,printMachId)} onClose={()=>{setShowPrint(false);setPrintMachId(null);}}/>}
 </div>;
}

function AddTypeRow({setTaskTypes,T}){
 const [ar,setAr]=useState('');const [en,setEn]=useState('');
 const add=()=>{if(!ar||!en)return;const key=en.toLowerCase().replace(/\s+/g,'_')+Date.now();setTaskTypes(p=>[...p,{id:gid(),key,ar,en}]);setAr('');setEn('');};
 return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,alignItems:'end',padding:12,backgroundColor:'#f8fafc',borderRadius:10}}>
  <div><label style={lbl}>{T.typeAr}</label><input style={iS('rtl')} value={ar} onChange={e=>setAr(e.target.value)}/></div>
  <div><label style={lbl}>{T.typeEn}</label><input style={iS('ltr')} value={en} onChange={e=>setEn(e.target.value)}/></div>
  <button style={{...bS(C.green),marginTop:18}} onClick={add}>{T.addTypeBtn}</button>
 </div>;
}

// ── WORK ORDERS (الجميع يسجل، المشرف فقط يعدل/يحذف) ──
function WorkOrders({workOrders,setWorkOrders,machines,personnel,T,isSup}){
 const [showM,setShowM]=useState(false);const [editId,setEditId]=useState(null);const [view,setView]=useState(null);const [showPrint,setShowPrint]=useState(false);
 const techs=personnel.filter(p=>p.type==='internal');
 const emptyF={machineId:'',task:'',date:fmtD(TODAY),techId:'',duration:'',notes:''};
 const [f,setF]=useState(emptyF);
 const save=()=>{if(!f.task)return;const m=machines.find(x=>x.id===parseInt(f.machineId));const t=techs.find(x=>x.id===parseInt(f.techId));const rec={...f,machineId:parseInt(f.machineId),machineName:m?.name||'',techId:parseInt(f.techId),techName:t?.name||''};if(editId)setWorkOrders(p=>p.map(x=>x.id===editId?{...rec,id:editId}:x));else setWorkOrders(p=>[...p,{...rec,id:gid()}]);setShowM(false);setEditId(null);};
 const del=id=>{if(window.confirm(T.confirmDel))setWorkOrders(p=>p.filter(x=>x.id!==id));};
 const totalH=workOrders.reduce((s,w)=>s+(parseFloat(w.duration)||0),0);
 const handlePrint=(title,_,selCols,hAlign)=>{
  const allCols=[{key:'machineName',label:T.machField},{key:'task',label:T.completedTask},{key:'date',label:T.execDate},{key:'techName',label:T.techExec},{key:'duration',label:T.dur},{key:'notes',label:T.notes}];
  const colDefs=allCols.filter(c=>!selCols||selCols[c.key]!==false);
  const rows=[...workOrders].reverse().map(wo=>'<tr>'+colDefs.map(c=>c.key==='duration'?'<td>'+wo.duration+' '+T.hrs+'</td>':'<td>'+(wo[c.key]||'-')+'</td>').join('')+'</tr>').join('');
  const stats='<div class="stats"><div class="stat"><div class="sv">'+workOrders.length+'</div><div class="sl">'+T.completedW+'</div></div><div class="stat"><div class="sv">'+totalH+'h</div><div class="sl">'+T.totalHrs+'</div></div></div>';
  doPrint('<div class="hdr"><div><div class="hdr-title">'+(title||T.woList)+'</div><div class="sub">'+T.reportDate+': '+new Date().toLocaleDateString()+'</div></div></div>'+stats+'<div class="sec"><table><thead><tr>'+colDefs.map(c=>'<th>'+c.label+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>',T,title||T.woList,hAlign);
  setShowPrint(false);
 };
 return <div style={{display:'flex',flexDirection:'column',gap:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
   <span style={{fontSize:13,color:C.gray}}>{T.regOps.replace('{n}',workOrders.length)}</span>
   <div style={{display:'flex',gap:8}}><button style={bS('#e2e8f0',C.gray)} onClick={()=>setShowPrint(true)}>{T.printWO}</button><button style={bS()} onClick={()=>{setF(emptyF);setEditId(null);setShowM(true);}}>{T.logWork}</button></div>
  </div>
  <div style={card}><div style={{overflowX:'auto'}}>
   <table style={{width:'100%',borderCollapse:'collapse'}}>
    <thead><tr style={{backgroundColor:'#f8fafc'}}>{[T.machField,T.completedTask,T.execDate,T.techExec,T.dur,T.actions].map(h=><th key={h} style={thS(T.dir)}>{h}</th>)}</tr></thead>
    <tbody>{[...workOrders].reverse().map(wo=><tr key={wo.id}>
     <td style={{...tdS,fontWeight:'600'}}>{wo.machineName}</td><td style={tdS}>{wo.task}</td><td style={tdS}>{wo.date}</td><td style={tdS}>{wo.techName}</td><td style={tdS}>{wo.duration} {T.hrs}</td>
     <td style={tdS}><div style={{display:'flex',gap:5}}>
      <button style={bS(C.accent+'22',C.accent)} onClick={()=>setView(wo)}>{T.viewBtn}</button>
      {isSup&&<><button style={bS('#fff3cd',C.yellow)} onClick={()=>{setF({machineId:wo.machineId,task:wo.task,date:wo.date,techId:wo.techId,duration:wo.duration,notes:wo.notes||''});setEditId(wo.id);setShowM(true);}}>✏️</button>
      <button style={bS('#fee2e222',C.red)} onClick={()=>del(wo.id)}>🗑️</button></>}
     </div></td>
    </tr>)}</tbody>
   </table>
  </div></div>
  {showM&&<Modal title={T.logWorkTitle} onClose={()=>{setShowM(false);setEditId(null);}}>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>
    <FG l={T.machField}><select style={iS(T.dir)} value={f.machineId} onChange={e=>setF({...f,machineId:e.target.value})}><option value="">{T.pickMach}</option>{machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></FG>
    <FG l={T.techExec}><select style={iS(T.dir)} value={f.techId} onChange={e=>setF({...f,techId:e.target.value})}><option value="">{T.pickTech}</option>{techs.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></FG>
    <FG l={T.completedTask} full><input style={iS(T.dir)} value={f.task} onChange={e=>setF({...f,task:e.target.value})}/></FG>
    <FG l={T.execDate}><input style={iS(T.dir)} type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></FG>
    <FG l={T.dur}><input style={iS(T.dir)} type="number" value={f.duration} onChange={e=>setF({...f,duration:e.target.value})}/></FG>
    <FG l={T.notes} full><textarea style={{...iS(T.dir),height:72,resize:'vertical'}} value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/></FG>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>{setShowM(false);setEditId(null);}}>{T.cancel}</button><button style={bS(C.green)} onClick={save}>{T.save}</button></div>
  </Modal>}
  {view&&<Modal title={T.detailsTitle} onClose={()=>setView(null)}>
   {[[T.machField,view.machineName],[T.completedTask,view.task],[T.execDate,view.date],[T.techExec,view.techName],[T.dur,view.duration+' '+T.hrs],[T.notes,view.notes||'-']].map(([k,v])=><div key={k} style={{display:'flex',gap:16,padding:'10px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:130,fontWeight:'600',color:C.gray,flexShrink:0,fontSize:13}}>{k}</div><div style={{color:'#1e293b',fontSize:13}}>{v}</div></div>)}
  </Modal>}
  {showPrint&&<PrintDialog T={T} defaultTitle={T.woList} cols={[{key:'machineName',label:T.machField},{key:'task',label:T.completedTask},{key:'date',label:T.execDate},{key:'techName',label:T.techExec},{key:'duration',label:T.dur},{key:'notes',label:T.notes}]} onPrint={handlePrint} onClose={()=>setShowPrint(false)}/>}
 </div>;
}

// ── PERSONNEL ─────────────────────────────────────────
function Personnel({personnel,setPersonnel,T,isSup}){
 const [tab,setTab]=useState('internal');const [showM,setShowM]=useState(false);const [edit,setEdit]=useState(null);
 const emptyF={name:'',role:'',type:tab,phone:'',email:'',fax:'',specialty:''};
 const [f,setF]=useState(emptyF);
 const list=personnel.filter(p=>p.type===tab);
 const save=()=>{if(!f.name)return;if(edit)setPersonnel(p=>p.map(x=>x.id===edit?{...f,id:edit}:x));else setPersonnel(p=>[...p,{...f,id:gid()}]);setShowM(false);};
 const del=id=>{if(window.confirm(T.confirmDel))setPersonnel(p=>p.filter(x=>x.id!==id));};
 return <div style={{display:'flex',flexDirection:'column',gap:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
   <div style={{display:'flex',gap:8}}>{[['internal',T.internalTab],['external',T.externalTab]].map(([k,v])=><button key={k} style={bS(tab===k?C.primary:'#f1f5f9',tab===k?'#fff':C.gray)} onClick={()=>setTab(k)}>{v}</button>)}</div>
   {isSup&&<button style={bS()} onClick={()=>{setF({...emptyF,type:tab});setEdit(null);setShowM(true);}}>{T.addP}</button>}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
   {list.map(p=><div key={p.id} style={{...card,display:'flex',gap:12,alignItems:'flex-start'}}>
    <div style={{width:44,height:44,borderRadius:'50%',backgroundColor:tab==='internal'?C.primary+'22':C.yellow+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{tab==='internal'?'👷':'🏢'}</div>
    <div style={{flex:1}}>
     <div style={{fontWeight:'bold',color:C.primary,fontSize:13}}>{p.name}</div>
     <div style={{fontSize:12,color:C.gray}}>{p.role}</div>
     <div style={{fontSize:12,color:C.gray}}>🔧 {p.specialty}</div>
     <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
      {p.phone&&<a href={'tel:'+p.phone} style={{...bS(C.green+'22',C.green),fontSize:12,textDecoration:'none',padding:'4px 10px'}}>📞</a>}
      {p.phone&&<a href={'https://wa.me/'+waNum(p.phone)} target="_blank" style={{...bS('#25D36622','#25D366'),fontSize:12,textDecoration:'none',padding:'4px 10px'}}>💬</a>}
      {p.email&&<a href={'mailto:'+p.email} style={{...bS(C.accent+'22',C.accent),fontSize:12,textDecoration:'none',padding:'4px 10px'}}>📧</a>}
      {p.fax&&<button style={{...bS(C.purple+'22',C.purple),fontSize:12,padding:'4px 10px'}} onClick={()=>{navigator.clipboard?.writeText(p.fax);alert('📠 '+p.fax);}}>📠</button>}
      <span style={{fontSize:12,color:C.gray,alignSelf:'center'}}>{p.phone}</span>
     </div>
    </div>
    {isSup&&<div style={{display:'flex',flexDirection:'column',gap:5}}>
     <button style={bS('#f1f5f9',C.gray)} onClick={()=>{setF({...p});setEdit(p.id);setShowM(true);}}>✏️</button>
     <button style={bS('#fee2e222',C.red)} onClick={()=>del(p.id)}>🗑️</button>
    </div>}
   </div>)}
   {list.length===0&&<div style={{...card,textAlign:'center',color:C.gray,padding:40,gridColumn:'1/-1'}}>{tab==='internal'?T.noIntP:T.noExtP}</div>}
  </div>
  {showM&&<Modal title={tab==='internal'?(edit?T.editIntTitle:T.addIntTitle):(edit?T.editExtTitle:T.addExtTitle)} onClose={()=>setShowM(false)}>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13}}>
    <FG l={T.fullName} full><input style={iS(T.dir)} value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></FG>
    <FG l={T.roleF}><input style={iS(T.dir)} value={f.role||''} onChange={e=>setF({...f,role:e.target.value})}/></FG>
    <FG l={T.specialty}><input style={iS(T.dir)} value={f.specialty||''} onChange={e=>setF({...f,specialty:e.target.value})}/></FG>
    <FG l={T.phoneF}><input style={iS(T.dir)} value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></FG>
    <FG l={T.faxF}><input style={iS(T.dir)} value={f.fax||''} onChange={e=>setF({...f,fax:e.target.value})}/></FG>
    <FG l={T.emailF} full><input style={iS(T.dir)} value={f.email||''} onChange={e=>setF({...f,email:e.target.value})}/></FG>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:18}}><button style={bS('#f1f5f9',C.gray)} onClick={()=>setShowM(false)}>{T.cancel}</button><button style={bS(C.green)} onClick={save}>{T.save}</button></div>
  </Modal>}
 </div>;
}

// ── REPORTS ───────────────────────────────────────────
function Reports({machines,schedules,workOrders,personnel,T,taskTypes,notes,settings}){
 const [showPrint,setShowPrint]=useState(false);
 const statusData=[{name:T.working,value:machines.filter(m=>m.status==='working').length,color:C.green},{name:T.maint,value:machines.filter(m=>m.status==='maint').length,color:C.yellow},{name:T.broken,value:machines.filter(m=>m.status==='broken').length,color:C.red}];
 const schedData=[{name:T.upcoming,value:schedules.filter(s=>s.status==='upcoming').length,color:C.accent},{name:T.overdue,value:schedules.filter(s=>s.status==='overdue').length,color:C.red},{name:T.done,value:schedules.filter(s=>s.status==='done').length,color:C.green}];
 const woByM=machines.map(m=>({name:m.name.length>12?m.name.slice(0,12)+'…':m.name,count:workOrders.filter(w=>w.machineId===m.id).length})).filter(x=>x.count>0);
 const woByT=personnel.filter(p=>p.type==='internal').map(p=>({name:p.name,count:workOrders.filter(w=>w.techId===p.id).length})).filter(x=>x.count>0);
 const totalH=workOrders.reduce((s,w)=>s+(parseFloat(w.duration)||0),0);
 const donePct=schedules.length>0?Math.round(schedules.filter(s=>s.status==='done').length/schedules.length*100):0;
 const handlePrint=(title,selSec,_,hAlign)=>{
  const date=new Date().toLocaleDateString();
  const stats='<div class="stats"><div class="stat"><div class="sv">'+machines.length+'</div><div class="sl">'+T.totalMach+'</div></div><div class="stat"><div class="sv">'+schedules.filter(s=>s.status==='upcoming').length+'</div><div class="sl">'+T.upcomingT+'</div></div><div class="stat"><div class="sv" style="color:'+C.red+'">'+schedules.filter(s=>s.status==='overdue').length+'</div><div class="sl">'+T.overdueT+'</div></div><div class="stat"><div class="sv" style="color:'+C.green+'">'+workOrders.length+'</div><div class="sl">'+T.completedW+'</div></div><div class="stat"><div class="sv">'+totalH+'h</div><div class="sl">'+T.totalHrs+'</div></div><div class="stat"><div class="sv">'+donePct+'%</div><div class="sl">'+T.completionPct+'</div></div></div>';
  const showAll=!selSec||Object.keys(selSec).length===0;let body='';
  if(showAll||selSec.machines){const mRows=machines.map(m=>{const late=schedules.filter(s=>s.machineId===m.id&&s.status==='overdue').length;return'<tr><td>'+m.name+'</td><td>'+m.dept+'</td><td><span class="badge '+sBadge(m.status)+'">'+tStatus(m.status,T)+'</span></td><td>'+schedules.filter(s=>s.machineId===m.id).length+'</td><td>'+workOrders.filter(w=>w.machineId===m.id).length+'</td><td><span class="badge '+(late>0?'r':'g')+'">'+late+'</span></td></tr>';}).join('');body+='<div class="sec"><div class="sec-t">'+T.machinesList+'</div><table><thead><tr><th>'+T.machName+'</th><th>'+T.dept+'</th><th>'+T.status+'</th><th>'+T.schedCount+'</th><th>'+T.compCount+'</th><th>'+T.overdueCount+'</th></tr></thead><tbody>'+mRows+'</tbody></table></div>';}
  if(showAll||selSec.schedules){const groups=machines.map(m=>({m,s:schedules.filter(x=>x.machineId===m.id)})).filter(g=>g.s.length>0);let sb='';groups.forEach(g=>{sb+='<div class="mach-hdr">⚙️ '+g.m.name+'</div><table><thead><tr><th>'+T.taskDesc+'</th><th>'+T.freq+'</th><th>'+T.nextDate+'</th><th>'+T.lastComp+'</th><th>'+T.assignedT+'</th><th>'+T.status+'</th></tr></thead><tbody>';g.s.forEach(x=>{sb+='<tr><td>'+x.task+'</td><td>'+displayFreq(x,T)+'</td><td>'+x.nextDate+'</td><td>'+(x.lastCompleted||'-')+'</td><td>'+x.assignedName+'</td><td><span class="badge '+sBadge(x.status)+'">'+tStat(x.status,T)+'</span></td></tr>';});sb+='</tbody></table>';});body+='<div class="sec"><div class="sec-t">'+T.schedsList+'</div>'+sb+'</div>';}
  if(showAll||selSec.workorders){const wRows=[...workOrders].reverse().map(wo=>'<tr><td>'+wo.machineName+'</td><td>'+wo.task+'</td><td>'+wo.date+'</td><td>'+wo.techName+'</td><td>'+wo.duration+' '+T.hrs+'</td><td>'+(wo.notes||'-')+'</td></tr>').join('');body+='<div class="sec"><div class="sec-t">'+T.woList+'</div><table><thead><tr><th>'+T.machField+'</th><th>'+T.completedTask+'</th><th>'+T.execDate+'</th><th>'+T.techExec+'</th><th>'+T.dur+'</th><th>'+T.notes+'</th></tr></thead><tbody>'+wRows+'</tbody></table></div>';}
  if((showAll||selSec.notes)&&notes)body+='<div class="sec"><div class="sec-t">'+T.notesTitle+'</div><div class="notes-box">'+notes+'</div></div>';
  doPrint('<div class="hdr"><div><div class="hdr-title">'+(title||T.reportTitle)+'</div><div class="sub">'+(settings.companyName||'')+' | '+T.reportDate+': '+date+'</div></div></div>'+((showAll||selSec.summary)?stats:'')+body,T,title||T.reportTitle,hAlign);
  setShowPrint(false);
 };
 const sections=[{key:'machines',label:T.secMachines},{key:'schedules',label:T.secSchedules},{key:'workorders',label:T.secWorkOrders},{key:'summary',label:T.secSummary},{key:'notes',label:T.secNotes}];
 return <div style={{display:'flex',flexDirection:'column',gap:18}}>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14}}>
   <StatCard icon="🏭" title={T.totalMach} value={machines.length} color={C.primary}/>
   <StatCard icon="📋" title={T.totalScheds} value={schedules.length} color={C.accent}/>
   <StatCard icon="✅" title={T.completedW} value={workOrders.length} color={C.green}/>
   <StatCard icon="⏱️" title={T.totalHrs} value={totalH+'h'} color={C.yellow}/>
   <StatCard icon="📊" title={T.completionPct} value={donePct+'%'} color={C.purple}/>
   <StatCard icon="👷" title={T.intCount} value={personnel.filter(p=>p.type==='internal').length} color={C.gray}/>
  </div>
  <button style={{...bS(C.primary),alignSelf:'flex-start'}} onClick={()=>setShowPrint(true)}>{T.printFull}</button>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
   <div style={card}><div style={{fontWeight:'bold',color:C.primary,marginBottom:10,fontSize:13}}>{T.machStatusChart}</div><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({name,value})=>name+': '+value}>{statusData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
   <div style={card}><div style={{fontWeight:'bold',color:C.primary,marginBottom:10,fontSize:13}}>{T.schedStatusChart}</div><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={schedData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({name,value})=>name+': '+value}>{schedData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
   {woByM.length>0&&<div style={card}><div style={{fontWeight:'bold',color:C.primary,marginBottom:10,fontSize:13}}>{T.workByMach}</div><ResponsiveContainer width="100%" height={180}><BarChart data={woByM}><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" fill={C.accent} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}
   {woByT.length>0&&<div style={card}><div style={{fontWeight:'bold',color:C.primary,marginBottom:10,fontSize:13}}>{T.workByTech}</div><ResponsiveContainer width="100%" height={180}><BarChart data={woByT}><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Bar dataKey="count" fill={C.green} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}
  </div>
  {showPrint&&<PrintDialog T={T} defaultTitle={T.reportTitle} sections={sections} onPrint={handlePrint} onClose={()=>setShowPrint(false)}/>}
 </div>;
}

// ── NOTES ─────────────────────────────────────────────
function NotesPage({notes,setNotes,T,isSup}){
 const [text,setText]=useState(notes);const [saved,setSaved]=useState(false);
 const save=()=>{setNotes(text);setSaved(true);setTimeout(()=>setSaved(false),2500);};
 return <div style={card}>
  <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:16}}>📝 {T.notesTitle}</div>
  <textarea style={{...iS(T.dir),height:400,resize:'vertical',marginBottom:12}} value={text} onChange={e=>{setText(e.target.value);setSaved(false);}} placeholder={T.notesPlaceholder} readOnly={!isSup}/>
  {isSup&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
   {saved&&<span style={{color:C.green,fontSize:13,fontWeight:'600'}}>{T.notesSaved}</span>}
   <button style={{...bS(C.green),marginRight:'auto'}} onClick={save}>{T.save}</button>
  </div>}
 </div>;
}

// ── SETTINGS ─────────────────────────────────────────
function Settings({T,supervisorPass,setSupervisorPass,userPass,setUserPass,settings,setSettings,taskTypes,setTaskTypes}){
 const [curr,setCurr]=useState('');const [np,setNp]=useState('');const [cp,setCp]=useState('');const [msg,setMsg]=useState('');
 const [uCurr,setUCurr]=useState('');const [uNp,setUNp]=useState('');const [uCp,setUCp]=useState('');const [uMsg,setUMsg]=useState('');
 const fileRef=useRef();
 const changePass=()=>{if(curr!==supervisorPass){setMsg(T.passWrong);return;}if(np!==cp){setMsg(T.passMismatch);return;}if(!np)return;setSupervisorPass(np);setCurr('');setNp('');setCp('');setMsg(T.passChanged);};
 const changeUserPass=()=>{if(uCurr!==userPass){setUMsg(T.passWrong);return;}if(uNp!==uCp){setUMsg(T.passMismatch);return;}if(!uNp)return;setUserPass(uNp);setUCurr('');setUNp('');setUCp('');setUMsg(T.passChanged);};
 const handleBg=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>setSettings(p=>({...p,bgImage:ev.target.result}));r.readAsDataURL(file);};
 return <div style={{display:'flex',flexDirection:'column',gap:20}}>
  <div style={card}>
   <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:16}}>🏭 {T.companyName}</div>
   <input style={{...iS(T.dir),maxWidth:400}} value={settings.companyName||''} onChange={e=>setSettings(p=>({...p,companyName:e.target.value}))} placeholder={T.appSub||''}/>
  </div>
  <div style={card}>
   <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:16}}>🖼️ {T.bgImage}</div>
   <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
    <button style={bS(C.accent)} onClick={()=>fileRef.current?.click()}>📁 {T.chooseBg}</button>
    {settings.bgImage&&<button style={bS('#fee2e2',C.red)} onClick={()=>setSettings(p=>({...p,bgImage:null}))}>{T.removeBg}</button>}
    <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleBg}/>
    {settings.bgImage&&<img src={settings.bgImage} alt="bg" style={{height:60,borderRadius:8,border:'1px solid #e2e8f0'}}/>}
   </div>
   {settings.bgImage&&<div style={{marginTop:14,display:'flex',flexDirection:'column',gap:16}}>
    <div>
     <label style={lbl}>{T.bgOpacity}: {Math.round((settings.bgOpacity||0.1)*100)}%</label>
     <input type="range" min="5" max="50" value={Math.round((settings.bgOpacity||0.1)*100)} onChange={e=>setSettings(p=>({...p,bgOpacity:e.target.value/100}))} style={{width:'100%',maxWidth:300}}/>
    </div>
    <div>
     <label style={lbl}>{T.bgRotation}: {settings.bgRotation||0}°</label>
     <input type="range" min="-180" max="180" step="5" value={settings.bgRotation||0} onChange={e=>setSettings(p=>({...p,bgRotation:parseInt(e.target.value)}))} style={{width:'100%',maxWidth:300}}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,maxWidth:400}}>
     <FG l={T.bgWidth+' (%)'}><input style={iS(T.dir)} type="number" min="0" max="500" placeholder="Cover" value={settings.bgWidth||''} onChange={e=>setSettings(p=>({...p,bgWidth:e.target.value}))}/></FG>
     <FG l={T.bgHeight+' (%)'}><input style={iS(T.dir)} type="number" min="0" max="500" placeholder="Cover" value={settings.bgHeight||''} onChange={e=>setSettings(p=>({...p,bgHeight:e.target.value}))}/></FG>
    </div>
    <div style={{fontSize:11,color:C.gray}}>💡 {T.bgSizeNote}</div>
    <div>
     <label style={lbl}>{T.bgLocationsTitle}</label>
     <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {[['login',T.bgLocLogin],['sidebarFull',T.bgLocSidebarFull],['sidebarBottom',T.bgLocSidebarBottom]].map(([key,label])=>{
       const active=bgShownAt(settings,key);
       return <button key={key} style={bS(active?C.accent:'#f1f5f9',active?'#fff':C.gray)}
        onClick={()=>setSettings(p=>({...p,bgLocations:{...DEFAULT_BG_LOCATIONS,...p.bgLocations,[key]:!bgShownAt(p,key)}}))}>
        {active?'✓ ':''}{label}
       </button>;
      })}
     </div>
    </div>
    <div>
     <button style={bS('#f1f5f9',C.gray)} onClick={()=>setSettings(p=>({...p,bgRotation:0,bgWidth:'',bgHeight:'',bgOpacity:0.1,bgLocations:{...DEFAULT_BG_LOCATIONS}}))}>{T.bgResetBtn}</button>
    </div>
   </div>}
  </div>
  <div style={card}>
   <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:6}}>🔐 {T.changePass}</div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,maxWidth:480}}>
    <FG l={T.currPass} full><input style={iS(T.dir)} type="password" value={curr} onChange={e=>{setCurr(e.target.value);setMsg('');}}/></FG>
    <FG l={T.newPass}><input style={iS(T.dir)} type="password" value={np} onChange={e=>{setNp(e.target.value);setMsg('');}}/></FG>
    <FG l={T.confirmPass}><input style={iS(T.dir)} type="password" value={cp} onChange={e=>{setCp(e.target.value);setMsg('');}}/></FG>
   </div>
   {msg&&<div style={{marginTop:8,fontSize:13,color:msg===T.passChanged?C.green:C.red,fontWeight:'600'}}>{msg}</div>}
   <button style={{...bS(C.primary),marginTop:14}} onClick={changePass}>{T.save}</button>
  </div>
  <div style={{...card,borderRight:'4px solid '+C.accent}}>
   <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:4}}>👷 {T.changeUserPass}</div>
   <div style={{fontSize:12,color:C.gray,marginBottom:14}}>💡 {T.userPassNote}</div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,maxWidth:480}}>
    <FG l={T.currPass} full><input style={iS(T.dir)} type="password" value={uCurr} onChange={e=>{setUCurr(e.target.value);setUMsg('');}}/></FG>
    <FG l={T.newPass}><input style={iS(T.dir)} type="password" value={uNp} onChange={e=>{setUNp(e.target.value);setUMsg('');}}/></FG>
    <FG l={T.confirmPass}><input style={iS(T.dir)} type="password" value={uCp} onChange={e=>{setUCp(e.target.value);setUMsg('');}}/></FG>
   </div>
   {uMsg&&<div style={{marginTop:8,fontSize:13,color:uMsg===T.passChanged?C.green:C.red,fontWeight:'600'}}>{uMsg}</div>}
   <button style={{...bS(C.accent),marginTop:14}} onClick={changeUserPass}>{T.save}</button>
  </div>
  <div style={card}>
   <div style={{fontWeight:'bold',color:C.primary,fontSize:15,marginBottom:16}}>🏷️ {T.manageTypes}</div>
   <div style={{border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden',marginBottom:12}}>
    {taskTypes.map(t=><div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid #f1f5f9'}}>
     <span><b style={{color:C.primary}}>{t.ar}</b><span style={{color:'#cbd5e1',margin:'0 6px'}}>|</span><span style={{color:C.gray,fontSize:12}}>{t.en}</span></span>
     <button style={bS('#fee2e222',C.red)} onClick={()=>{if(window.confirm(T.confirmDel))setTaskTypes(p=>p.filter(x=>x.id!==t.id))}}>🗑️</button>
    </div>)}
   </div>
   <AddTypeRow setTaskTypes={setTaskTypes} T={T}/>
  </div>
 </div>;
}

// ── MAIN APP ──────────────────────────────────────────
export default function App(){
 const [lang,setLang]=useState('ar');
 const [page,setPage]=useState('dashboard');
 const [userRole,setUserRole]=useState(null); // null | 'supervisor' | 'user'
 const [supPass,setSupPass]=useState('admin');
 const [userPass,setUserPass]=useState('1234');
 const [machines,setMachines]=useState(initMachines);
 const [schedules,setSchedules]=useState(initSchedules);
 const [workOrders,setWorkOrders]=useState(initWorkOrders);
 const [personnel,setPersonnel]=useState(initPersonnel);
 const [taskTypes,setTaskTypes]=useState(initTaskTypes);
 const [sideOpen,setSideOpen]=useState(true);
 const [showNotif,setShowNotif]=useState(false);
 const [notes,setNotes]=useState('');
 const [settings,setSettings]=useState({companyName:'',bgImage:null,bgOpacity:0.1,bgRotation:0,bgWidth:'',bgHeight:'',bgLocations:{...DEFAULT_BG_LOCATIONS}});
 const T=TR[lang];
 const isSup=userRole==='supervisor';

 useEffect(()=>{
  setSchedules(p=>p.map(s=>{if(s.status==='done')return s;return{...s,status:diffDays(s.nextDate)<0?'overdue':'upcoming'};}));
 },[]);

 // ── Firebase sync ──
 const [dataLoaded,setDataLoaded]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 const localWrite=useRef(false);

 const refreshFromFirebase=async()=>{
  setRefreshing(true);
  try{
   const {db}=await import('./firebase');
   const {doc,getDoc}=await import('firebase/firestore');
   const keys=['machines','schedules','workOrders','personnel','taskTypes','notes','settings','auth'];
   const snaps=await Promise.all(keys.map(k=>getDoc(doc(db,'appData',k))));
   const [m,s,w,p,tt,n,set,auth]=snaps.map(x=>x.exists()?x.data():null);
   if(m?.items)setMachines(m.items);
   if(s?.items)setSchedules(s.items.map(x=>x.status==='done'?x:{...x,status:diffDays(x.nextDate)<0?'overdue':'upcoming'}));
   if(w?.items)setWorkOrders(w.items);
   if(p?.items)setPersonnel(p.items);
   if(tt?.items)setTaskTypes(tt.items);
   if(n?.content!==undefined)setNotes(n.content);
   if(set)setSettings(prev=>({...prev,...set}));
   if(auth?.supPass)setSupPass(auth.supPass);
   if(auth?.userPass)setUserPass(auth.userPass);
  }catch(e){console.error('Refresh error:',e);}
  setRefreshing(false);
 };

 useEffect(()=>{
  const init=async()=>{
   let s0=null;
   try{
    const {db}=await import('./firebase');
    const {doc,getDoc}=await import('firebase/firestore');
    const keys=['machines','schedules','workOrders','personnel','taskTypes','notes','settings','auth'];
    const snaps=await Promise.all(keys.map(k=>getDoc(doc(db,'appData',k))));
    const [m,s,w,p,tt,n,set,auth]=snaps.map(x=>x.exists()?x.data():null);
    if(m?.items)setMachines(m.items);
    if(s?.items)s0=s.items;
    if(w?.items)setWorkOrders(w.items);
    if(p?.items)setPersonnel(p.items);
    if(tt?.items)setTaskTypes(tt.items);
    if(n?.content!==undefined)setNotes(n.content);
    if(set)setSettings(prev=>({...prev,...set}));
    if(auth?.supPass)setSupPass(auth.supPass);
    if(auth?.userPass)setUserPass(auth.userPass);
   }catch(e){console.error('Firebase load:',e);}
   setSchedules(p=>(s0||p).map(s=>s.status==='done'?s:{...s,status:diffDays(s.nextDate)<0?'overdue':'upcoming'}));
   setDataLoaded(true);
  };
  init();
 },[]);

 useEffect(()=>{
  if(!dataLoaded)return;
  let unsubs=[];
  (async()=>{
   try{
    const {db}=await import('./firebase');
    const {doc,onSnapshot}=await import('firebase/firestore');
    unsubs=[
     onSnapshot(doc(db,'appData','machines'),snap=>{if(snap.exists()&&!localWrite.current)setMachines(snap.data().items||[]);}),
     onSnapshot(doc(db,'appData','schedules'),snap=>{if(snap.exists()&&!localWrite.current)setSchedules(snap.data().items||[]);}),
     onSnapshot(doc(db,'appData','workOrders'),snap=>{if(snap.exists()&&!localWrite.current)setWorkOrders(snap.data().items||[]);}),
     onSnapshot(doc(db,'appData','personnel'),snap=>{if(snap.exists()&&!localWrite.current)setPersonnel(snap.data().items||[]);}),
     onSnapshot(doc(db,'appData','notes'),snap=>{if(snap.exists()&&!localWrite.current)setNotes(snap.data().content||'');}),
    ];
   }catch(e){console.error('Firebase listen:',e);}
  })();
  return()=>unsubs.forEach(u=>u&&u());
 },[dataLoaded]);

 useEffect(()=>{
  if(!dataLoaded)return;
  const t=setTimeout(async()=>{
   try{
    const {db}=await import('./firebase');
    const {doc,writeBatch}=await import('firebase/firestore');
    localWrite.current=true;
    const b=writeBatch(db);
    b.set(doc(db,'appData','machines'),{items:machines});
    b.set(doc(db,'appData','schedules'),{items:schedules});
    b.set(doc(db,'appData','workOrders'),{items:workOrders});
    b.set(doc(db,'appData','personnel'),{items:personnel});
    b.set(doc(db,'appData','taskTypes'),{items:taskTypes});
    b.set(doc(db,'appData','notes'),{content:notes});
    b.set(doc(db,'appData','settings'),settings);
    b.set(doc(db,'appData','auth'),{supPass,userPass});
    await b.commit();
    setTimeout(()=>{localWrite.current=false;},1000);
   }catch(e){console.error('Firebase save:',e);}
  },1200);
  return()=>clearTimeout(t);
 },[machines,schedules,workOrders,personnel,taskTypes,notes,settings,supPass,userPass,dataLoaded]);

 const alertCount=schedules.filter(s=>s.status==='overdue'&&!s.notified&&Math.abs(diffDays(s.nextDate))>=(s.notifyAfterDays||3)).length;
 const nav=[{id:'dashboard',icon:'📊',label:T.navd},{id:'machines',icon:'⚙️',label:T.navm},{id:'schedules',icon:'📅',label:T.navs},{id:'workorders',icon:'📋',label:T.navw},{id:'personnel',icon:'👥',label:T.navp},{id:'reports',icon:'📈',label:T.navr},{id:'notes',icon:'📝',label:T.navnotes},...(isSup?[{id:'settings',icon:'🔐',label:T.navset}]:[])];

 if(!userRole) return <LoginScreen T={T} onLogin={role=>{setUserRole(role);setPage('dashboard');}} supervisorPass={supPass} userPass={userPass} settings={settings}/>;

 return <div dir={T.dir} style={{display:'flex',height:'100vh',fontFamily:'Tahoma,Arial,sans-serif',overflow:'hidden',fontSize:14,backgroundColor:'#f1f5f9'}}>
  <div style={{width:sideOpen?224:56,backgroundColor:C.primary,transition:'width 0.3s',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',position:'relative',zIndex:2}}>
   <BgLayer settings={settings} locationKey="sidebarFull"/>
   <div style={{padding:'15px 12px',borderBottom:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',gap:10,whiteSpace:'nowrap',position:'relative',zIndex:1,flex:'0 0 auto'}}>
    <span style={{fontSize:22,flexShrink:0}}>🏭</span>
    {sideOpen&&<div><div style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>{T.appName}</div><div style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>{settings.companyName||''}</div></div>}
   </div>
   <nav style={{flex:'0 1 auto',minHeight:0,padding:'6px 0',overflowY:'auto',position:'relative',zIndex:1}}>
    {nav.map(n=>{const act=page===n.id;return <div key={n.id} onClick={()=>setPage(n.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer',backgroundColor:act?'rgba(255,255,255,0.13)':'transparent',borderRight:act&&T.dir==='rtl'?'3px solid #38bdf8':'none',borderLeft:act&&T.dir==='ltr'?'3px solid #38bdf8':'none',color:act?'#38bdf8':'rgba(255,255,255,0.72)',whiteSpace:'nowrap',transition:'all 0.2s',userSelect:'none'}}>
     <span style={{fontSize:16,flexShrink:0}}>{n.icon}</span>{sideOpen&&<span style={{fontSize:13}}>{n.label}</span>}
    </div>;})}
   </nav>
   <div style={{flex:'1 0 0%',minHeight:0,position:'relative'}}>
    <BgLayer settings={settings} locationKey="sidebarBottom"/>
   </div>
   <div onClick={()=>setSideOpen(!sideOpen)} style={{padding:'11px 14px',cursor:'pointer',color:'rgba(255,255,255,0.35)',borderTop:'1px solid rgba(255,255,255,0.08)',textAlign:'center',fontSize:11,userSelect:'none',position:'relative',zIndex:1,flex:'0 0 auto'}}>{sideOpen?T.fold:'►'}</div>
  </div>
  <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative',zIndex:1}}>
   <div style={{backgroundColor:'rgba(255,255,255,0.97)',padding:'12px 20px',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
    <div style={{fontWeight:'bold',color:C.primary,fontSize:15}}>{nav.find(n=>n.id===page)?.label}</div>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
     {schedules.filter(s=>s.status==='overdue').length>0&&<div style={{backgroundColor:'#fee2e2',color:C.red,padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:'600'}}>⚠️ {schedules.filter(s=>s.status==='overdue').length} {T.overdueNotif}</div>}
     {isSup&&<button onClick={()=>setShowNotif(true)} style={{...bS(alertCount>0?C.red:'#f1f5f9',alertCount>0?'#fff':C.gray),position:'relative',padding:'7px 12px'}}>
      🔔{alertCount>0&&<span style={{position:'absolute',top:-4,right:-4,backgroundColor:C.red,color:'#fff',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'bold'}}>{alertCount}</span>}
     </button>}
     <button onClick={refreshFromFirebase} style={bS(refreshing?'#f1f5f9':C.green+'22',refreshing?C.gray:C.green)} title={T.lang==='ar'?'تحديث البيانات':'Refresh Data'}>{refreshing?'⏳':'🔄'}</button>
     <button onClick={()=>setLang(l=>l==='ar'?'en':'ar')} style={bS('#e0f2fe',C.accent)}>🌐 {T.langBtn}</button>
     <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{fontSize:12,fontWeight:'bold',color:C.primary,padding:'4px 10px',backgroundColor:isSup?C.primary+'15':C.accent+'15',borderRadius:8}}>
       {isSup?'👑 '+T.supRole:'👷 '+T.userRole}
      </div>
      <button onClick={()=>{setUserRole(null);setPage('dashboard');}} style={bS('#fee2e2',C.red)} title={T.logoutBtn}>↩</button>
     </div>
    </div>
   </div>
   <div style={{flex:1,overflow:'auto',padding:18}}>
    {page==='dashboard'&&<Dashboard machines={machines} schedules={schedules} workOrders={workOrders} T={T}/>}
    {page==='machines'&&<Machines machines={machines} setMachines={setMachines} T={T} isSup={isSup}/>}
    {page==='schedules'&&<Schedules schedules={schedules} setSchedules={setSchedules} machines={machines} personnel={personnel} T={T} taskTypes={taskTypes} setTaskTypes={setTaskTypes} isSup={isSup}/>}
    {page==='workorders'&&<WorkOrders workOrders={workOrders} setWorkOrders={setWorkOrders} machines={machines} personnel={personnel} T={T} isSup={isSup}/>}
    {page==='personnel'&&<Personnel personnel={personnel} setPersonnel={setPersonnel} T={T} isSup={isSup}/>}
    {page==='reports'&&<Reports machines={machines} schedules={schedules} workOrders={workOrders} personnel={personnel} T={T} taskTypes={taskTypes} notes={notes} settings={settings}/>}
    {page==='notes'&&<NotesPage notes={notes} setNotes={setNotes} T={T} isSup={isSup}/>}
    {page==='settings'&&isSup&&<Settings T={T} supervisorPass={supPass} setSupervisorPass={setSupPass} userPass={userPass} setUserPass={setUserPass} settings={settings} setSettings={setSettings} taskTypes={taskTypes} setTaskTypes={setTaskTypes}/>}
   </div>
  </div>
  {showNotif&&<NotificationsPanel schedules={schedules} setSchedules={setSchedules} personnel={personnel} T={T} onClose={()=>setShowNotif(false)}/>}
 </div>;
}