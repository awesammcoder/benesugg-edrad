(function(){
  class App {
    constructor(){
      this.pages = document.querySelectorAll('.pot-navigator');
      this.container = document.getElementById('app');
      this.controllers = {};
      this.active_controller = '';
      this.recordHandler = {};
      this.statuses = ['For Checking', 'Returned', 'For Approved', 'For Distribution'];
      this.revisionCode = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';

      this.summary = {};
      this.summary[this.statuses[0]] = 0;
      this.summary[this.statuses[1]] = 0;
      this.summary[this.statuses[2]] = 0;
      this.summary[this.statuses[3]] = 0;
    }

    init(){
      this.bindEvents();
    }

    bindEvents(){
      this.pages.forEach(page => {
        page.addEventListener('click', e => {
          e.preventDefault();
          if(this.active_controller != page.dataset.pot){
            this.loadController(page.dataset.pot);
          }
        });
      });
    }

    setControllers(data){
      this.controllers = data;
    }

    loadController(controller){
      this.active_controller = controller;
      this.controller = this.controllers[controller];
      this.loadPage(controller, () => {
        this.initController();
      });
    }

    initController(){
      this.controller.init();
    }

    loadPage(page, loadController){
      $.ajax({
        url: `pages/${page}.pot`,
        type: 'GET',
        success: page => {
          this.container.innerHTML = page;
          loadController();
        }
      });
    }

    loadDefault(controller){
      if(location.hash){
        controller = location.hash.substr(1);
      }

      this.loadController(controller);
    }
  }

  // Storage Model
  class CustomStorage {
    constructor(){
      this.data = localStorage.documentStorage ? JSON.parse(localStorage.documentStorage) : {};
    }

    insert(id, value){
      if(!this.data.hasOwnProperty(id)){
        this.data[id] = {
          info: value,
          revisions: [],
          history: []
        }
      }else{
        value.revision_id = id + this.getRevisionLetter(id);
        value.revision_letter = this.getRevisionLetter(id);
        this.pushRevision(id, value);
      }
      this.localSave();
      return this.getRevisions(id);
    }

    getDocument(id){
      return this.data.hasOwnProperty(id) ? this.data[id]: null;
    }

    getRevisionLetter(id){
      return app.revisionCode[this.data[id].revisions.length];
    }

    getRevisions(id){
      return this.data[id].revisions;
    }

    pushRevision(id, revision){
      return this.data[id].revisions.push(revision);
    }

    pushHistory(history){
      this.data[history.id].history.push(history);
      this.localSave();
      return this.getHistories(history.id);
    }

    getHistories(id){
      return this.data[id].history;
    }

    localSave(){
      localStorage.documentStorage = JSON.stringify(this.data);
      return this.data;
    }
  }

  // Controllers
  class MenuPage {
    constructor(){
      this.controller = 'menu';
    }

    init(){
      this.status = {};
      this.status[app.statuses[0]] = document.getElementById('for-checking');
      this.status[app.statuses[1]] = document.getElementById('for-returned');
      this.status[app.statuses[2]] = document.getElementById('for-approved');
      this.status[app.statuses[3]] = document.getElementById('for-distribution');

      this.table = document.getElementById('menu-list');
      this.printToTable(this.normalizeDocuments());
    }

    printToTable(documents){
      var doc = '', datetime;

      documents.forEach(document => {
        datetime = new Date(document.order).toLocaleString();
        doc += `<tr data-info='${JSON.stringify(document)}'>
        <td>${document.id}</td>
        <td>${document.revision_letter ? document.revision_letter : ''}</td>
        <td>${document.originator}</td>
        <td>${document.department}</td>
        <td>${datetime}</td>
        <td>${document.status}</td>
        </tr>`
      });
      this.table.innerHTML = doc;
      this.bindRecordOnClick();
    }

    bindRecordOnClick(){
      var records = document.querySelectorAll('tr[data-info]');
      records.forEach(record => {
        record.addEventListener('click', () => {
          app.recordHandler = JSON.parse(record.dataset.info);
          app.loadDefault('document');
        });
      });
    }

    normalizeDocuments(){
      var documents = [], document;
      for(var i in documentStorage.data){
        document = documentStorage.data[i];
        documents.push(document.info);

        document.revisions.forEach(revision => {
          documents.push(revision);
          app.summary[revision.status]++;
        });
        app.summary[document.info.status]++;
      }

      this.printSummary();
      return documents.sort((a, b) => {
        return a.order - b.order;
      }).reverse();

    }

    printSummary(){
      for(var i in this.status){
        this.status[i].innerText = app.summary[i];
      }
    }
  }

  class DocumentPage {
    constructor(){
      this.controller = 'document';
    }

    init(){
      this.submit = document.getElementById('document-submit');
      this.document_no = document.getElementById('document-no');
      this.revision_letter = document.getElementById('revision-letter');
      this.type = document.getElementById('document-type');
      this.received_date = document.getElementById('document-received-date');
      this.received_time = document.getElementById('document-received-time');
      this.originator = document.getElementById('document-originator');
      this.department = document.getElementById('document-department');

      this.remarks = document.getElementById('document-remarks');
      this.status = document.getElementById('document-status');
      this.document_co = document.getElementById('document-co');

      this.date = document.getElementById('document-date');
      this.time = document.getElementById('document-time');
      this.table = document.getElementById('history-table');

      this.r = app.recordHandler;

      this.loadHistory();
      this.loadDateAndTime();
      this.startTimer();
      this.cancelKeyPress();
      this.bindRecords();
      this.bindEvents();
    }

    bindRecords(){

      var r = this.r;

      this.document_no.value = r.id;
      this.revision_letter.value = r.revision_letter;
      this.type.value = r.localeType;
      this.received_date.value = r.date;
      this.received_time.value = r.time;
      this.originator.value = r.originator;
      this.department.value = r.department;

    }

    bindEvents(){
      this.submit.addEventListener('click', ()=>{
        if(confirm("Are you sure to save changes?")){
          documentStorage.pushHistory(this.getValues());
          this.loadHistory();
        }
      });
    }

    loadHistory(histories = false){
      var data = histories || documentStorage.getHistories(this.r.id);
      var fragments = '', d;

      data.reverse().forEach(h => {
        d = new Date(h.datetime).toGMTString();
        fragments += `<tr>
        <td>${h.revision_letter || ''}</td>
        <td>${h.remarks}</td>
        <td>${d}</td>
        <td>${h.from_status}</td>
        <td>${h.to_statusLocale}</td>
        <td>${h.care_of || ''}</td>
        </tr>`
      });

      this.table.innerHTML = fragments;
    }

    getValues(){
      var d = new Date();
      return {
        id: this.r.id,
        revision_letter: this.r.revision_letter,
        remarks: this.remarks.value,
        datetimeLocale: d.toLocaleDateString(),
        datetime: +d,
        from_status: this.r.status,
        to_status: this.status.value,
        to_statusLocale: app.statuses[this.status.value],
        care_of: this.document_co.value
      }
    }

    cancelKeyPress(override = false){
      var elements = ['document-no', 'revision-letter', 'document-type', 'document-received-date', 'document-received-time', 'document-originator', 'document-department', 'document-time', 'document-date'];
      if(!override){
        elements.forEach(id => {
          document.getElementById(id).addEventListener('keypress', (e) =>{
            e.preventDefault();
          });

          document.getElementById(id).addEventListener('keydown', (e) =>{
            e.preventDefault();
          });
        });
      }
    }

    startTimer(){
      this.timer = setInterval(() => {
        if(app.active_controller != this.controller){
          clearInterval(this.timer);
        }
        this.loadDateAndTime();
      }, 1000);
    }

    loadDateAndTime(){
      var d = new Date();
      this.date.value = `${d.getFullYear()}-${d.getMonth() < 10 ? '0' + d.getMonth() : d.getMonth()}-${d.getDate() < 10 ? '0' + d.getDate() : d.getDate()}`;
      this.time.value = d.toLocaleTimeString();
    }
  }

  class ReceivePage {
    constructor(){
      this.controller = 'receive';
    }

    init(){
      this.document_type = document.getElementById('document-type');
      this.document_id = document.getElementById('document-id');
      this.originator = document.getElementById('document-originator');
      this.department = document.getElementById('document-department');
      this.revision_letter = document.getElementById('next-revision-letter');
      this.time = document.getElementById('document-time');
      this.date = document.getElementById('document-date');
      this.submit = document.getElementById('document-submit');

      this.bindEvents();
      this.loadDateAndTime();
      this.startTimer();
    }

    bindEvents(){
      this.date.addEventListener('keydown', e => {
        e.preventDefault();
      });

      this.date.addEventListener('keypress', e => {
        e.preventDefault();
      });

      this.time.addEventListener('keypress', e => {
        e.preventDefault();
      });

      this.document_id.addEventListener('keyup', () => {
        if(documentStorage.getDocument(this.document_id.value)){
          this.revision_letter.value = documentStorage.getRevisionLetter(this.document_id.value);
          return;
        }
        this.revision_letter.value = '';
      });

      this.revision_letter.addEventListener('keypress', e => {
        e.preventDefault();
      });

      this.submit.addEventListener('click', e => {
        if(confirm("Are you sure to submit this document details?")){
          var info = this.getValues();
          documentStorage.insert(info.id, info);
          app.loadDefault('menu');
        }
      });
    }

    getValues(){
      return {
        type: this.document_type.value,
        id: this.document_id.value,
        revision_id: null,
        revision_letter: null,
        date: this.date.value,
        time: this.time.value,
        localeType: +this.document_type.value > 0 ? 'Revised Document' : 'New Document',
        originator: this.originator.value,
        department: this.department.value,
        status: app.statuses[0],
        order: +new Date()
      };
    }

    startTimer(){
      this.timer = setInterval(() => {
        if(app.active_controller != this.controller){
          clearInterval(this.timer);
        }
        this.loadDateAndTime();
      }, 1000);
    }

    loadDateAndTime(){
      var d = new Date();
      this.date.value = `${d.getFullYear()}-${d.getMonth() < 10 ? '0' + d.getMonth() : d.getMonth()}-${d.getDate() < 10 ? '0' + d.getDate() : d.getDate()}`;
      this.time.value = d.toLocaleTimeString();
    }
  }


  const app = new App();
  const documentStorage = new CustomStorage();

  app.init();
  app.setControllers({
    document: new DocumentPage(),
    receive: new ReceivePage(),
    menu: new MenuPage()
  });

  app.loadDefault('menu');

})();