-- تحديث بيانات برنامج الجمال للأدوات المدرسية (إصدار 2.0.0)
BEGIN;

TRUNCATE TABLE invoice_items, invoices, payments RESTART IDENTITY CASCADE;
DELETE FROM products;
DELETE FROM customers;

INSERT INTO customers (code, name, phone, address, customer_type, balance) VALUES
('C10001', 'عميل نقدي', '', '', 'عادي', 0),
('C10002', 'مكتبة النور', '01222355769', 'القاهرة - مدينة نصر', 'جملة', 0),
('C10003', 'مدرسة الأمل الابتدائية', '01222355769', 'الجيزة - المهندسين', 'مدرسة', 0),
('C10004', 'شركة الصفا للقرطاسية', '01222355769', 'الإسكندرية', 'جملة', 0),
('C10005', 'معرض المستقبل', '01222355769', 'المنصورة', 'عادي', 0);

INSERT INTO products (code, barcode, name, category, unit, purchase_price, sale_price, quantity, min_quantity, tax_rate, active) VALUES
('1001','6223002001001','كراسة مسطرة 100 ورقة','كراسات وكشاكيل','كراسة',12,18,240,30,0,true),
('1002','6223002001002','كراسة مربعات 60 ورقة','كراسات وكشاكيل','كراسة',8,12,300,40,0,true),
('1003','6223002001003','دفتر ملاحظات A5 غلاف مقوى','كراسات وكشاكيل','دفتر',22,32,110,15,0,true),
('1004','6223002001004','ورق تصوير A4 أبيض 500 ورقة','كراسات وكشاكيل','رزمة',95,125,65,10,0,true),
('1005','6223002001005','ورق ملون 20 لون','كراسات وكشاكيل','حزمة',28,40,90,12,0,true),
('1006','6223002001006','قلم رصاص HB عبوة 12','أقلام','علبة',30,42,150,20,0,true),
('1007','6223002001007','قلم حبر أزرق عبوة 10','أقلام','علبة',35,50,160,20,0,true),
('1008','6223002001008','قلم حبر أحمر عبوة 10','أقلام','علبة',35,50,120,20,0,true),
('1009','6223002001009','قلم جاف أسود','أقلام','قطعة',5,8,400,50,0,true),
('1010','6223002001010','قلم ماركر سبورة بيضاء','أقلام','قطعة',14,22,8,15,0,true),
('1011','6223002001011','ممحاة بيضاء كبيرة','أدوات مدرسية','قطعة',3,5,350,40,0,true),
('1012','6223002001012','مبراة معدنية بعلبة','أدوات مدرسية','قطعة',6,10,220,30,0,true),
('1013','6223002001013','مسطرة بلاستيك 30 سم','أدوات هندسية','قطعة',7,12,180,25,0,true),
('1014','6223002001014','مجموعة أدوات هندسية 4 قطع','أدوات هندسية','علبة',38,55,75,10,0,true),
('1015','6223002001015','منقلة 180 درجة','أدوات هندسية','قطعة',5,9,130,20,0,true),
('1016','6223002001016','ألوان خشب 12 لون','ألوان ورسم','علبة',32,48,95,12,0,true),
('1017','6223002001017','ألوان مائية 12 لون مع فرشاة','ألوان ورسم','علبة',45,65,60,10,0,true),
('1018','6223002001018','أقلام فلوماستر 24 لون','ألوان ورسم','علبة',75,105,4,10,0,true),
('1019','6223002001019','فرشاة رسم عريضة','ألوان ورسم','قطعة',9,15,100,15,0,true),
('1020','6223002001020','لاصق سائل 50 مل','قرطاسية مكتبية','عبوة',11,17,140,20,0,true),
('1021','6223002001021','شريط لاصق شفاف كبير','قرطاسية مكتبية','لفافة',8,13,170,25,0,true),
('1022','6223002001022','مقص مكتبي صغير','قرطاسية مكتبية','قطعة',18,27,85,12,0,true),
('1023','6223002001023','دباسة مكتبية مع دبابيس','قرطاسية مكتبية','قطعة',42,60,55,8,0,true),
('1024','6223002001024','ملف بلاستيك شفاف A4','قرطاسية مكتبية','قطعة',3,5,500,60,0,true),
('1025','6223002001025','حافظة أقلام قماشية','حقائب وإكسسوارات','قطعة',25,38,90,12,0,true),
('1026','6223002001026','شنطة مدرسية قماش','حقائب وإكسسوارات','قطعة',145,210,35,6,0,true),
('1027','6223002001027','آلة حاسبة مكتبية 12 رقم','إلكترونيات مكتبية','قطعة',85,120,28,5,0,true),
('1028','6223002001028','قلّام سبورة خشبي','إلكترونيات مكتبية','قطعة',15,24,70,10,0,true),
('1029','6223002001029','سلاح التلميذ – اللغة العربية','كتب خارجية','كتاب',75,110,45,8,0,true),
('1030','6223002001030','سلاح التلميذ – الرياضيات','كتب خارجية','كتاب',48,70,55,8,0,true),
('1031','6223002001031','كتاب الأضواء – العلوم','كتب خارجية','كتاب',60,85,40,8,0,true),
('1032','6223002001032','كتاب الامتحان – اللغة العربية','كتب خارجية','كتاب',95,140,50,8,0,true),
('1033','6223002001033','كتاب الامتحان – العلوم','كتب خارجية','كتاب',95,140,48,8,0,true),
('1034','6223002001034','كتاب الامتحان – الدراسات','كتب خارجية','كتاب',85,120,42,8,0,true),
('1035','6223002001035','كشكول A4 مسطر 192 ورقة','كراسات وكشاكيل','كشكول',18,28,130,20,0,true),
('1036','6223002001036','كشكول رسم 100 ورقة','كراسات وكشاكيل','كشكول',22,32,95,15,0,true),
('1037','6223002001037','كراسة طباعة 200 ورقة','كراسات وكشاكيل','كراسة',14,22,160,20,0,true),
('1038','6223002001038','كراسة ملاحظات جيب A4','كراسات وكشاكيل','كراسة',16,25,120,20,0,true),
('1039','6223002001039','كراسة تلوين 80 ورقة','كراسات وكشاكيل','كراسة',20,30,85,12,0,true),
('1040','6223002001040','كشكول شفاف بجيب','كراسات وكشاكيل','كشكول',12,20,110,15,0,true);

INSERT INTO invoices (invoice_no, type, customer_id, customer_name, payment_type, subtotal, discount, tax, total, paid, remaining, notes, status, invoice_date, created_at) VALUES
('1001','sale',(SELECT id FROM customers WHERE code='C10002'),'مكتبة النور','نقدي',204,10,0,194,194,0,'تجهيز مكتبة','محفوظة',now(),now()),
('1002','sale',(SELECT id FROM customers WHERE code='C10003'),'مدرسة الأمل الابتدائية','آجل',510,0,0,510,100,410,'طلب مدرسي آجل','آجل',now(),now()),
('1003','purchase',(SELECT id FROM customers WHERE code='C10004'),'شركة الصفا للقرطاسية','نقدي',360,0,0,360,360,0,'توريد أدوات مدرسية','محفوظة',now(),now()),
('1004','sale',(SELECT id FROM customers WHERE code='C10002'),'مكتبة النور','قسط',238,0,0,238,0,238,'قسط بدون ميعاد','آجل',now() - interval '75 days',now() - interval '75 days'),
('1005','sale',(SELECT id FROM customers WHERE code='C10005'),'معرض المستقبل','قسط',300,0,0,300,100,200,'قسط بدون ميعاد','آجل',now() - interval '40 days',now() - interval '40 days');

INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, barcode, unit, quantity, price, discount, total)
SELECT 1, id, code, name, barcode, unit, 4, 18, 0, 72 FROM products WHERE code='1001'
UNION ALL
SELECT 1, id, code, name, barcode, unit, 2, 42, 0, 84 FROM products WHERE code='1006'
UNION ALL
SELECT 1, id, code, name, barcode, unit, 1, 48, 0, 48 FROM products WHERE code='1016'
UNION ALL
SELECT 2, id, code, name, barcode, unit, 2, 125, 0, 250 FROM products WHERE code='1004'
UNION ALL
SELECT 2, id, code, name, barcode, unit, 3, 50, 0, 150 FROM products WHERE code='1007'
UNION ALL
SELECT 2, id, code, name, barcode, unit, 2, 55, 0, 110 FROM products WHERE code='1014'
UNION ALL
SELECT 3, id, code, name, barcode, unit, 5, 32, 0, 160 FROM products WHERE code='1016'
UNION ALL
SELECT 3, id, code, name, barcode, unit, 10, 11, 0, 110 FROM products WHERE code='1020'
UNION ALL
SELECT 3, id, code, name, barcode, unit, 30, 3, 0, 90 FROM products WHERE code='1024'
UNION ALL
SELECT 4, id, code, name, barcode, unit, 2, 95, 0, 190 FROM products WHERE code='1032'
UNION ALL
SELECT 4, id, code, name, barcode, unit, 1, 48, 0, 48 FROM products WHERE code='1030'
UNION ALL
SELECT 5, id, code, name, barcode, unit, 10, 18, 0, 180 FROM products WHERE code='1035'
UNION ALL
SELECT 5, id, code, name, barcode, unit, 2, 60, 0, 120 FROM products WHERE code='1031';

UPDATE products SET quantity = quantity - 4 WHERE code = '1001';
UPDATE products SET quantity = quantity - 2 WHERE code = '1004';
UPDATE products SET quantity = quantity - 2 WHERE code = '1006';
UPDATE products SET quantity = quantity - 3 WHERE code = '1007';
UPDATE products SET quantity = quantity - 1 WHERE code = '1016';
UPDATE products SET quantity = quantity - 2 WHERE code = '1014';
UPDATE products SET quantity = quantity + 5 WHERE code = '1016';
UPDATE products SET quantity = quantity + 10 WHERE code = '1020';
UPDATE products SET quantity = quantity + 30 WHERE code = '1024';
UPDATE products SET quantity = quantity - 2 WHERE code = '1032';
UPDATE products SET quantity = quantity - 1 WHERE code = '1030';
UPDATE products SET quantity = quantity - 10 WHERE code = '1035';
UPDATE products SET quantity = quantity - 2 WHERE code = '1031';

INSERT INTO payments (customer_id, amount, method, note, payment_date, created_at) VALUES
((SELECT id FROM customers WHERE code='C10003'), 100, 'نقدي', 'دفعة تحت الحساب', now(), now()),
((SELECT id FROM customers WHERE code='C10005'), 100, 'نقدي', 'قسط – دفعة 15', now() - interval '15 days', now() - interval '15 days');

UPDATE customers SET balance = 238 WHERE code = 'C10002';
UPDATE customers SET balance = 410 WHERE code = 'C10003';
UPDATE customers SET balance = 200 WHERE code = 'C10005';

INSERT INTO settings (key, value) VALUES
('storeName','الجمال للأدوات المدرسية'),
('subtitle','للأدوات المدرسية والمكتبية'),
('phone','01222355769'),
('address','جمهورية مصر العربية'),
('taxNumber',''),
('currency','ج.م'),
('defaultTax','0'),
('printer','الطابعة الافتراضية للنظام'),
('footer','شكراً لتعاملكم معنا'),
('theme','blue'),
('customPrimary',''),
('customAccent',''),
('invoiceHeader','الجمال للأدوات المدرسية'),
('invoiceSubtitle','للأدوات المدرسية والمكتبية والقرطاسية'),
('invoiceAccent','#0b4fa2'),
('invoiceTableHeader','#e4f0fc'),
('invoiceLogoUrl',''),
('invoiceShowLogo','true'),
('invoiceShowBarcode','true'),
('invoiceShowTax','true'),
('invoiceShowBalance','true'),
('invoicePaper','A4'),
('invoiceFontSize','12'),
('invoiceFooter','شكراً لتعاملكم معنا — لا ترد البضاعة بعد 3 أيام'),
('visibleModules',''),
('customModules','[{"id":"cm-schools","label":"تجهيز طلب المدارس","target":"sales","icon":"GraduationCap","color":"#7b4bc4","content":"قائمة سريعة لتجهيز طلب المدارس: الكراسات، الأقلام، الأدوات الهندسية، الكتب الخارجية والحقائب."}]'),
('uiFlags','')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;
