var table_state = 'Activities';     // what is currently being displayed?
var datatable;
// var table_source;                   // store data for the DataTables plugin to render
// var resource_table = {"Activities": []};
var table_ref;                      // reference variable for accessing the data table
var select_expanded = false;        // used to dynamically render the dropdown- checkbox menu
const columns = [{ title: "Resource Name" }, { title: "Description" }, { title: "Duration" }, { title: "Grade Level "},
                    { title: "Subject" }, { title: "Tech Required "}, { title: "Author" }];

// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    console.log('table length ' + resource_table.Activities.length);
    _buildTable();
    _setupFeatures();
    _handleSearch();

    // switch between activity and curriculum views
    $('input[name=view]').click(function() {
        var selected = $('input[name=view]:checked').val();
        if(selected != table_state) {
            table_state = selected;
            renderTable(); 
            // renderFeatures();  
        }
    });

    // $('input[name=tech-required]').change(function() {
    //   renderTable();
    //   renderFeatures();
    // });
    $('.dataTables_filter').addClass('pull-left');
    $('.dataTables_length').addClass('pull-left');
});

/*
    Render the datatable with activities filtered by user
    @param {boolean} search - 'true' if user has filtered activities. 
        'false' if the whole table should be rendered
*/
function renderTable(search=false) {
    var render_data = _filterResources(resource_table[table_state]);
    var table_source = [];
    var search_string = _getSearchString();//$('input[type="search"]').val();
    // var resource_link;
    if(render_data.length == 0) {
        alert('This Search returned no activities.');
        return;   
    }
    
    renderFeatures(render_data);

    $.map(render_data, function(item, index) {
        var subjects = Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"];
        // var author_link = '<a target="_blank" href="' + item["Author Link"] + '">' + item["Author"] + '</a>';
        var activity_link = '<a target="_blank" href="' + item["Resource Link"] + '"">' + item["Resource Name"] + '</a>';

        var lightbox = _moreInfo(item, index);

        if(item['Tags'].includes('incomplete')) {
            resource_link = _adaptActivity(activity_link, index, item["Resource Name"]);
        } else
            resource_link = activity_link;

        table_source.push([resource_link, item["Description"], item["Duration"], item["Grade Level"], subjects, item["Tech Required"], lightbox]);       
    });

    if(table_ref)
        _refreshTable(table_source, search_string);
    if(search) {
        document.querySelector('#content').scrollIntoView({ 
          behavior: 'smooth' 
        });
        location.hash = search_string;
    }
    return table_source;
}

/*
    Render 3 Featured Activities at the top of the page. Collect a list of all
    activities with img urls that match the set of filters chosen. Then pick
    features from this list based on keywords
*/
function renderFeatures(render_data) {
    var feature_list = [];
    $.map(render_data, function(item) {
        if(item["Img URL"] != "") {
            feature_list.push(item);
        }
    });


    var features = _buildFeatures(feature_list);
    $('#feature-container').show();
    if(features.length < 3) {
        $('#feature-container').hide();
        return;
    }
    
    $(".featured-activity").each(function(i) {
        $(this).empty();
        var feature_id = 'feature' + (i + 1);
        var subjects = Array.isArray(features[i]["Subject"]) ? features[i]["Subject"].join(", ") : features[i]["Subject"];
        var feature_div = `
            <a href="#" data-featherlight="#`+ feature_id +`"><div class="feature"><img class="feature" src="`+ features[i]["Img URL"] +`" /></div><br />
            <span>`+ features[i]["Resource Name"] +`</span></a>
                <div style="display: none"><div id="`+ feature_id +`" style="padding: 10px;">
                    <h3>Activity Page: <a target="_blank" href="`+ features[i]["Resource Link"] +`">`+ features[i]["Resource Name"] +`</a></h3>
                    <br />`+ features[i]["Description"] +`<br /><br />
                    <b>Grade Level: </b>`+ features[i]["Grade Level"] +`<br />
                    <b>Subject: </b>`+ subjects +`<br />
                    <b>Tech Required: </b>`+ features[i]["Tech Required"] +`<br />
                    <b>Author: </b><a href="`+ features[i]["Author Link"] +`">`+ features[i]["Author"] +`</a>
                </div>`;
        $(this).append(feature_div);
    });

}

/* 
    Reset all filters to their default values
*/
function resetFilters() {
    _resetFilters();
    $('input[type="search"]').val("");
    renderTable();
}
/*
    Create a search string from the chosen filter options.
*/
function _getSearchString() {
    var search_params = [];

    // if($('input[type="search"]').val() != "")
    //     search_params.push($('input[type="search"]').val());
    
    if($('#subject').val() != "") 
        search_params.push("Subject=" + $('#subject').val());

    if($('#grade').val() != "")
        search_params.push("Grade=" + $('#grade').val());

    if($('#no-tech').is(':checked'))
        search_params.push('unplugged');

    if($('#tech').is(':checked'))
        search_params.push('tech');

    return "q=" + search_params.join('&');
}

/*
    Get the "Resource Table" Google sheet from https://docs.google.com/spreadsheets/d/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/
    Once the HTTP Request is complete, call helper functions to populate the array and build
    page features. This function makes use of the Google Sheets API
    Reference: https://developers.google.com/sheets/api/
    @private
*/
function _buildTable() {
    // _displayLoading(true);
    _addGradeRange();
    _renderSelects();
    // var table = _setupDataTable(renderTable());
    _setupDataTable(renderTable());
    // renderFeatures();
    // return;
    
    $.ajax({
        url: "https://content-sheets.googleapis.com/v4/spreadsheets/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/values/A2%3AM",
        type: "get",
        data: {
          majorDimension: 'ROWS',
          // ranges: 'A7:M10',
          key: API_KEY
        },
        success: function(response) {
            var new_activities = _storeData(response);
            // _displayLoading(false);
            _addGradeRange(new_activities);
            _updateSelects();
            renderTable();
        },
        error: function(error) {
            _displayError(error);
        },
        timeout: 10000
    });
}

/*
    Display some text or graphic to show that the resources are still loading
*/
function _displayLoading(loading) {
    if(loading)
        $('#load-div').show();
    else
        $('#load-div').hide();
}

/*
    Store Google Sheet data in the resource_table variable
    This involves parsing every row from the table (stored as arrays)
    into individual JSON objects
    @param {object} response- REST response 
    @private
*/
function _storeData(response) {
    var new_activities = [];
    console.log("processing " + response.values.length + " activities from Google Sheets");
    for(let i=0; i<response.values.length; i++) {
        var value = response.values[i];
        if(!value[11])
            value[11] = "";
        
        // resource_table.Activities.push({
        var new_activity = {
          "Resource Name": value[0],
          "Resource Link": value[1],
          "Duration": value[2],
          "Grade Level": value[3],
          "Subject": value[4].split(", "),
          "Tech Required": value[5].split(", "),
          "Author": value[6],
          "Author Link": value[7],
          "Tags": value[8].split(", "),
          "Additional Info": value[9],
          "Description": value[10],
          "Img URL": value[11]
        };

        if(!resource_table.Activities.find(act => act["Resource Name"] === new_activity["Resource Name"])) {
            console.log("pushing " + new_activity["Resource Name"]);
            resource_table.Activities.push(new_activity);
            new_activities.push(new_activity);
        }
    }
    return new_activities;
}

/*
    Wrap our table with the DataTables plugin from https://www.datatables.net/
    This makes the columns sortable and options for filtering by a search bar
    and displaying n entries per page.
*/
function _setupDataTable(table_source) {
    // custom grade sort could use some improvement, e.g. so 3-9 is higher than K-5
    jQuery.fn.dataTableExt.oSort["grade-desc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return y-x;
    };

    jQuery.fn.dataTableExt.oSort["grade-asc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return x-y;
    };

    table_ref = $('#resource-table').DataTable({
        data: table_source,
        // columns: columns
      "pageLength": 50,
      "columnDefs": [
            { "orderable": false, "targets": [1, 4, 5, 6] },
            { "type": "grade", "targets": 3 }
            // { "dom": '<"wrapper"fli>' }
        ]
    });
    // datatable = table_ref;
    // return table_ref;
}

function _setupFeatures() {
    $('#resource-table_filter').after(`
    <span id="content"> </span>
    <section id="feature-container">
      <br /><h3>Featured Activities:</h3><br />
      <div class="features">
        <div class="featured-activity" id="featurediv1"></div>
        <div class="featured-activity" id="featurediv2"></div>
        <div class="featured-activity" id="featurediv3"></div>
      </div>
    </section>`);
}

function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            renderTable(true);
        }
});
}