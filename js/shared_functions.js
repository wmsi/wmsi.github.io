// Shared functions between different versions of the STEM Resource Table (ie master and dev branches)
//TODO: reorder functions from most- to least-used



/*
    Obtain search results and cache them locally while displaying pages one at a time
    @param {int} page_size - number of results to render per page
    @param {int} page - page number <-- deprecated?
    TODO: how do we implement sort with the page by page approach?
*/
function renderPages(page_size=50, page=0) {
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    _displayLoading(true);
    // console.log('getting query ' + query_string);
    $('.grid-container').show();
    var search_results = [];
    // var url = "https://wmsinh.org/airtable?query=" + query_string;
    var url = "https://wmsinh.org/airtable";
    // var url = "http://localhost:5000/airtable";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url,
        data: {
            query: query_string
        }
    }).done(function(data, status, jqXHR) {
        search_results=JSON.parse(data);
        _manageTableLocal(search_results, page_size);
        _renderFeatures(search_results);
        _displayLoading(false);
        document.querySelector('#results').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/* 
    Reset all filters to their default values
*/
function resetFilters() {
    $('#subject').val("");
    $('#grade').val("");
    $(':checkbox').prop('checked',true);
    $('#self-led').prop('checked', false);
    $('input[type="search"]').val("");
}

/*
    Build a query string for the Airtable API. This query will take into account all filters 
    and the text-based search.
    @private
*/
function _getQueryString() {
    var query = "AND(";
    if($('#subject').val() != "") 
        query += "Find('" + $('#subject').val() + "', Subject), ";
        // search_params.push("Subject=" + $('#subject').val());

    if($('#experience').val() != "") 
        query += "Find('" + $('#experience').val() + "', Experience), ";

    if($('#self-led').is(':checked'))
        query += "Find('self-led', Tags), ";

    query += _getMaterialsQuery();

    if($('input[type="search"]').val() != '')
        query += "Find('" + $('input[type="search"]').val().toLowerCase() + "', {Search Text}), ";

    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + ")";
    if(query == "AND)")
        alert('Please use at least one search option to find resources.');
    return query;
}

/*
    Helper function for _getQueryString
    Compile all the materials checkboxes into part of the Airtable query
    @private
*/
function _getMaterialsQuery() {
    var query = "OR(";

    if($('#browser').is(':checked'))
        query += "Find('Computer w/ Browser', Materials), ";
    if($('#pen-paper').is(':checked'))
        query += "Find('Pen and Paper', Materials), ";
    if($('#craft').is(':checked'))
        query += "Find('Craft Supplies', Materials), ";
    if($('#tablet').is(':checked'))
        query += "Find('Tablet', Materials), ";
    if($('#robotics').is(':checked'))
        query += "Find('Robotics', Materials), ";

    if(query == "OR(")
        return "";

    string_preslice = query;
    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + "), ";
    return query;
}

/*
    Build an ordered list of featured activities based on search results
    Most relevant/ highly rated activities sort towards the top of list.
    TODO: Continue to refine criteria for sorting/ filtering
            Ideally we end up with one sort() and one filter()

    @param {list} search_results - list of resource objects returned from airtable search
    @returns {list} feature_list - featured activities sorted with most relevant towards the top
    @private
*/
function _buildFeatureList(search_results) {
    var feature_list = [];
    search_results.forEach(function(resource) {
        // push all items to list that have a thumbnail and are not incomplete
        if(resource.Thumbnail != undefined && !resource.Tags.includes('incomplete'))
            feature_list.push(resource);
    });

    // sort by rating
    feature_list.sort(function(a, b) {
        var a_rating = a.Rating == undefined ? 0 : a.Rating;
        var b_rating = b.Rating == undefined ? 0 : b.Rating;
        // take number of votes into account?

        return b_rating - a_rating;
    });

    // no duplicate sources next to each other
    return feature_list.filter(function(resource, i, feature_list) {
        if(i == 0)
            return true;
        return !(resource.Source == feature_list[i-1].Source);
    });

    // return feature_list;
}

/*
    Sort search results by field values. Event triggered when user clicks an 
    arrow next to one of the column headers
    @param {array} search_results - activities returned by Airtable
    @returns {boolean} true if table was built from existing sort, false if no build happens
    @private
    TODO: we could avoid calling this with every search by keeping a permanent reference to
        search_results
*/
function _sortResults(search_results, build=true) {
    $('i').unbind('click').click(function() {
        var ascending = $(this).attr('class') == 'up' ? true : false;
        var field = $(this).parent().attr('id');
        
        console.log('sorting by ' + field + ' with build ' + build);
        if(field == "activity")
            _sortText(search_results, "Resource Name", ascending);
        if(field == "author")
            _sortText(search_results, "Source", ascending);
        if(field == "time")
            _sortTime(search_results, ascending);
        if(field == "experience")
            _sortExperience(search_results, ascending);
        if(field == "subject")
            _sortText(search_results, "Subject", ascending)
        if(field == "rating")
            _sortRating(search_results, ascending);
        if(build) {
            _clearTable();
            _buildTable(search_results);
        }
        $('i').css('border-color', 'black');
        $('i').removeAttr('alt');
        $(this).css('border-color', 'green');
        $(this).attr('alt', 'selected');
    });
    // if sort exists from previous search apply it to this one
    $('i[alt="selected"]').click();
    if($('i[alt="selected"]').length)
        return true;
    else
        return false;
}

/*
    Handle an event when stars are clicked in order to post a new rating to Airtable
    Post ratings using Ajax request to a secure API proxy, in order to hide API key
    @param {array} search_results - list of resources returned by Airtable from a user-generated search
    @private
*/
function _postRatings(search_results) {
    $('.star').click(function() {
        var name = $(this).parent().attr('id');
        var rating = $(this).attr('id').split('star')[1];
        if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
            var resource = search_results.find(x => x["Resource Name"] == name);
            var votes = (resource.Votes == undefined ? 0 : resource.Votes);
            var new_rating = (resource.Rating*votes + parseInt(rating))/(++votes);
            if(resource.Rating == undefined) 
                new_rating = parseInt(rating);
            console.log('posting rating of ' + new_rating + ' based on ' + votes + ' votes');
            _updateStars(this, name, new_rating, votes);

            $.ajax({
                type: 'POST',
                url: 'https://wmsinh.org/airtable',
                data: {
                    "id": resource.id,
                    "Rating": new_rating,
                    "Votes": votes
                }
            });
        }
    });
}

/*
    Generate HTML for all resources returned by a search query. 
    Called by renderTable()
    @param {array} search_resutls - resources returned by a query search to airtable
    @private
*/
function _buildTable(search_results) {
    console.log('building ' + search_results.length + ' resources');
    var new_elements;
    var grid_item = "<span class='item'>*</span>";
    search_results.forEach(function(resource, index) {
        var activity_link = grid_item.replace('*', '<a target="_blank" href="'+ resource["Resource Link"] +'">'+ resource["Resource Name"] +'</a>');
        if(resource['Tags'].includes('incomplete')) 
            activity_link = _adaptActivity(resource, index);
            // activity_link = _adaptActivity(activity_link.replace(" class='item'",""), index, resource["Resource Name"]);
        else
            console.log('building activity with link ' + activity_link);
        
        new_elements = activity_link;
        author_link = '<a target="_blank" href="' + resource["Source Link"] + '">' + resource["Source"] + '</a>'
        new_elements += grid_item.replace('*', author_link);
        new_elements += grid_item.replace('*', resource["Duration"]);
        new_elements += grid_item.replace('*', resource["Experience"]);
        new_elements += grid_item.replace('*', resource["Subject"]);
        new_elements += grid_item.replace('*', _starsMarkup(resource));
        new_elements += grid_item.replace('*',  "<center><big><a href='#' data-featherlight='#resource" + index + "'>&#9432;</a></big></center>");
        // $('.grid-container').append(new_elements); 
        $('#content').append(new_elements); 
        _addLightbox(resource, index);
    }); 
    _postRatings(search_results);
}

/*
    Modify html template to create a lightbox with "Info" for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here (comments?)
*/
function _addLightbox(resource, index) {
    var html_template = $('#info-lightbox-template').html();
    html_template = html_template.replace('*id', 'resource' + index);
    html_template = html_template.replace('*class', 'lightbox-grid');
    html_template = html_template.replace('*link', resource["Resource Link"]);
    html_template = html_template.replace('*title', resource["Resource Name"]);
    if(resource.Thumbnail != undefined) 
        html_template = html_template.replace('*img',resource.Thumbnail[0].url);
    // else generic thumbnail image
    html_template = html_template.replace('*description', resource["Description"]);
    html_template = html_template.replace('*materials', resource["Materials"]);
    html_template = html_template.replace('*tags', resource.Tags);
    if(resource["Tags"].includes("incomplete"))  
        html_template = html_template.slice(0,html_template.indexOf('</div>')) +  _adaptLightbox(resource);
    $('#content').append(html_template);
}

function _adaptLightbox(resource) {
    return $('#adapt-text-template').html() + '</div>';
} 

/*
    Create a special lightbox for any activity that does not meet our lesson standards,
    and so requires adaptation by a teacher in order to be run as a classroom activity
    @param {resource} resource - Link to the activity page
    @param {int} index - activity index number used for building element IDs
    @private
*/
function _adaptActivity(resource, index) {
    console.log('adapting template for ' + resource["Resource Name"]);
    var markup = $('#adapt-lightbox-template').html();
    markup = markup.replace(/@id/g, 'adapt'+index);
    markup = markup.replace('*class', 'item');
    markup = markup.replace(/title/g, resource["Resource Name"]);
    markup = markup.replace('*link', resource["Resource Link"]);
    return markup;
}

/*
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table

    TODO: use this function instead of FeatherlightJS for lightboxes
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

/*
    Add rating column for an activity. As of 1/12/20 this feature is being
    rendered as responsive stars to click for a rating and a number/10 
    existing rating.
    @param {object} resrouce - Airtable resource object
    @private
*/
function _starsMarkup(resource) {
    var markup = $('#stars-template').html().replace('stars-id', resource["Resource Name"]);
    if(resource.Rating == undefined)
        markup = markup.replace('rating/5 by num','');
    else {
        markup = markup.replace('rating', Number.isInteger(resource.Rating) ? resource.Rating : resource.Rating.toFixed(2));
        markup = markup.replace('num', resource.Votes + (resource.Votes == 1 ? ' vote' : ' votes'));
    }

    return markup;
}

/*
    Update a rating after it has been posted to the database
    This function changes the html for an activity's rating to 
    reflect the new user input.
    @param {object} resource - 
    @param {float} rating - new rating for the activity
    @param {int} votes - number of votes, including the one just made
    @private
*/
function _updateStars(element, name, rating, votes) {
    rating = Number.isInteger(rating) ? rating : rating.toFixed(2);
    var rating_string = rating + '/5 by ' + votes + ' votes';
    parent = $(this).parent();
    $(element).parent().parent().find('small').html(rating_string);

    // var markup = $('#stars-template').html().replace('stars-id', name);
    // markup = markup.replace('rating', Number.isInteger(rating) ? rating : rating.toFixed(2));
    // markup = markup.replace('num', votes + (votes == 1 ? ' vote' : ' votes'));
}

/*
    Display a spinner graphic to show that results are still loading
    @param {boolean} loading - true to show the spinner, false to hide it
    @private
*/
function _displayLoading(loading) {
    if(loading)
        $('.lds-ring').show();// $('#load-div').show();
    else
        $('.lds-ring').hide();//$('#load-div').hide();
}

/*
    Clear the table from previous search results
    @private
*/
function _clearTable() {
    $('.item').remove();
    $('.ligthbox-grid').remove();
}





////////////////////////////// PAGE FUNCTIONS ////////////////////////////////////////
/*
    Change the number of results displayed per page
    Call renderPage() to load a new page size from Airtable
    @param {int} start - search_resutls index of the current first activity 
        (used to find page number)
    @private
*/
function changePageLength(start) {
    var page_size = $('#results-per-page').val();
    var page = Math.floor(start/page_size);
    console.log('new page length ' + page_size +' and page num ' + page);
    renderPage(page_size, page);
}

/*
    Change the number of results displayed per page
    Call _manageTableLocal() to load a new page of results
    @param {int} start - search_resutls index of the current first activity 
        (used to find page number)
    @param {array} search_results - all activities that match the current search
    @private
*/
function changePageLengthLocal(start, search_results) {
    var page_size = $('#results-per-page').val();
    var page = Math.floor(start/page_size);
    console.log('new page length ' + page_size +' and page num ' + page);
    _manageTableLocal(search_results, page_size, page);
}

/*
    Display results meta data above the table. Meta data includes length of results,
    results per page, current page number, etc.
    @param {array} search_results - records returned by airtable
    @param {int} page_size - max number of records per page
    @private
*/
function _displayMetaData(search_results, page_size, page_num=0, num_results=search_results.length) {
    // console.log('display meta for page num ' + page_num +', page size ' + page_size + ', num results ' + num_results);
    $('#results-meta').empty();
    if(num_results == 0)
        $('#results-meta').html("We're sorry but your search did not return any results.");
    else if(num_results == 1)
        $('#results-meta').html("Displaying " + search_results.length + " Result.");
    else if(search_results.length < num_results) {         // pagination in effect
        var start = page_size*page_num + 1;
        var end = page_size*(page_num + 1) < num_results ? page_size*(page_num + 1) : num_results;
        $('#results-meta').html("Displaying " + start + "-" + end + " of " + num_results + " Results.");
    } else {
        $('#results-meta').html("Displaying " + search_results.length + " Results.");
    }
}

/*
    Attach behavior to Next Page and Last Page buttons using locally stored results
    Unbind any functions previously attached to those buttons
    Change styling to reflect (in)active buttons
    @param {array} search_results - all results that match the current search
    @param {int} page_size - number of results to render per page
    @param {int} page - current page number
    @private
*/
function _createLocalButtons(search_results, page_size, page=0) {
    var next_page = (page+1)*page_size < search_results.length ? true : false;
    var last_page = page > 0 ? true : false;
    if(next_page) {
        $('#next-page').unbind('click').click(function() {
            _manageTableLocal(search_results, page_size, page+1);
        });
    }

    if(last_page) {
        $('#last-page').unbind('click').click(function() {
            _manageTableLocal(search_results, page_size, page-1);
        });
    }

    _buttonCss(next_page, last_page);
}

/*
    Alter CSS for page buttons depending on table state
    Inactive button is grey and doesn't act like a link
    @param {boolean} next_page - true if there is a next page in the table
    @param {boolean} last_page - true if there is a previous page in the table
    @private
*/
function _buttonCss(next_page, last_page) {
    if(next_page) {
        $('#next-page').css({'cursor': '', 'color': ''});
    } else {
        $('#next-page').unbind('click');
        $('#next-page').css({'cursor': 'default', 'color': 'grey'});   
    }
    if(last_page) {
        $('#last-page').css({'cursor': '', 'color': ''});
    } else {
        $('#last-page').unbind('click');
        $('#last-page').css({'cursor': 'default', 'color': 'grey'});
    }
}



////////////////////////////// SORT FUNCTIONS ////////////////////////////////////////
/* Used for sorting resources based on field values. Called by _sortResults()   */

/*
    Sort results by text field in alphabetical order
    Currently this is the default if no other sort is selected
    @param {array} search_results - Airtable activities based on search options
    @param {string} field - resource field key to sort by
    @param {boolean} ascending - true = a to z, false = z to a
    @private
*/
function _sortText(search_results, field, ascending) {
    if(ascending)
        search_results.sort((a, b) => a[field].localeCompare(b[field]));
    else
        search_results.sort((a, b) => b[field].localeCompare(a[field]));
    return search_results;
}

/*
    Sort results by the duration of the activity
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} ascending - true = short to long, false = long to short
    @private
    TODO: how well do we want to handle edge cases of 1h00+, 1-2 hours, etc.?
*/
function _sortTime(search_results, ascending) {
    search_results.sort(function(a, b) {

        var a_time = parseFloat(a.Duration.replace('h','.'));
        var b_time = parseFloat(b.Duration.replace('h','.'));
        if(ascending)
            return a_time - b_time;
        else
            return b_time - a_time;
    });
}

/*
    Sort results by the experience required for an activity
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} ascending - true = low to high, false = high to low
    @private
*/
function _sortExperience(search_results, ascending) {
    var exp = ["Early Learner","Beginner","Intermediate","Advanced"];
    search_results.sort(function(a, b) {
        var a_experience = a.Experience.includes(",") ? a.Experience.split(",")[0] : a.Experience;
        var b_experience = b.Experience.includes(",") ? b.Experience.split(",")[0] : b.Experience;
        if(ascending)
            return exp.indexOf(a_experience) - exp.indexOf(b_experience);
        else
            return exp.indexOf(b_experience) - exp.indexOf(a_experience);
    });
}

/*
    Sort results by Rating from high to low
    Currently this is the default if no other sort is selected
    @param {array} search_results - Airtable activities based on search options
    @private
*/
function _sortRating(search_results, ascending=false) {
    search_results.sort(function(a, b) {
        var a_rating = a.Rating == undefined ? 0 : a.Rating;
        var b_rating = b.Rating == undefined ? 0 : b.Rating;
        if(ascending)
            return a_rating - b_rating;
        else
            return b_rating - a_rating;
    });
}

////////////////////////////// SEARCH FUNCTIONS ////////////////////////////////////////
/* Used for sorting resources based on field values. Called by _sortResults()   */

/*
    Apply the grade range filter to an array of activities and return a filtered array
    @param {array} activities - array to filter
    @returns {array} of activities that match the user-defined grade level
    @private
*/
function _applyGradeFilter(activities) {
    var grade_filter = $('#grade').val();
    var render_activities = [];
    // console.log('applying grade filter to ' + activities.length + ' activities');

    if(grade_filter != "") {
        if(grade_filter === 'K') grade_filter = 0;
        else grade_filter = parseInt(grade_filter);

        $.each(activities, function(index, item) {
            if(grade_filter >= item["Grade Range"].low && grade_filter <= item["Grade Range"].high)
                render_activities.push(item);
        });
    } else render_activities = activities;

    console.log('returning ' + render_activities.length + ' activities');
    return render_activities;
}

/*
    Parent function for rendering the drop down menus at the top of the table
    Populate each menu with the options available in the activities array
    @private
*/
function _renderSelects() {
    subjects = ["Computer Science", "Social Studies", "Language Arts", "Music", "Visual Arts", "Physical Education", "Science", "Engineering"];
    _renderSelect("#subject","Subject", subjects);
    // _renderGradeSelect();
    _renderExperienceSelect();
}

/*
    Add options to a dropdown menu
    @param {string} id - HTML id of the dropdown to create
    @param {string} key - JSON key in the Activity object that corresponds to the options for this menu
    @private
*/
function _renderSelect(id, key, data) {
    var select_options = $(id).children().toArray().map(i => i.innerHTML);
    var new_options = [];
    data.forEach(item => new_options.push(item));

    $(id).append(
        $.map(new_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

/*
    Add options to the experience level dropdown menu
    Give users optiosn for beginner, intermediate, advanced
    @private
*/
function _renderExperienceSelect() {
    var grade_options = ['Early Learner','Beginner','Intermediate','Advanced'];
    $('#experience').append(
        $.map(grade_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

/*
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
*/
function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            $('#search').click();
        }
    });
}



















////////////////////////////// DEPRECATED ////////////////////////////////////////
/*
    Create a lightbox to house the "More Info" text for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here
*/
function _addLightboxDEPRECATED(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            *link
            <br />
            <span><center>*description</center></span><br /><hr>
            <span>*materials</span><br />
            <span>*tags</span>
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    if(resource["Tags"].includes("incomplete")) 
        html_template = html_template.replace('*link', _adaptActivityLightbox(resource, index));
    else {
        html_template = html_template.replace('*link', "<a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>");
        html_template = html_template.replace('*link', resource["Resource Link"]);
        if(resource.Thumbnail != undefined) 
            html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
        html_template = html_template.replace('*title', resource["Resource Name"]);
    }
    html_template = html_template.replace('*description', resource["Description"]);
    if(resource.Materials != "None")
        html_template = html_template.replace('*materials',  "This activity requires the following materials: " + resource["Materials"]);
    html_template = html_template.replace('*tags', "Keyword tags: " + resource.Tags);
    // $('.grid-container').append(html_template);
    $('#content').append(html_template);
}

/*
    Add a code-interpretable grade range to an activity in the array
    'K' get stored as grade 0. The upper limit for unbounded range is 12
    @param {array} data- activities that need a grade range added
    @private
*/
function _addGradeRange(data=resource_table.Activities) {
    $.each(data, function(index, item) {
        item["Grade Range"] = {};
        var low = item["Grade Level"][0];
        var high;

        if(item["Grade Level"][item["Grade Level"].length-1] === '+') {
            high = 12;
        } else {
            high = parseInt(item["Grade Level"].split('-')[1]);
        }

        if(low === 'K') low = 0;
        else low = parseInt(low);

        item["Grade Range"]["low"] = low;
        item["Grade Range"]["high"] = high;
    });
}

/*
    Add options to the grade level dropdown menu
    Give users all grade options from K-12
    @private
*/
function _renderGradeSelect() {
    var grade_options = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];
    $('#grade').append(
        $.map(grade_options, function(item) {
            return '<option value="' + item + '">' + item + '</option>';
        }).join());
}

function _adaptActivityDEPRECATED(activity_link, index, name) {
    // console.log('building adaptation with link: ' + activity_link);
    // var resource_link = '<a href="#" target="_blank" data-featherlight="#adapt' + index + '">' + name + '</a>';
    var resource_link = '<span class="item"><a href="#" target="_blank" data-featherlight="#adapt' + index + '">' + name + '</a></span>';
    resource_link += '<div style="display: none"><div id="adapt' + index + '" style="padding: 10px;">';
    resource_link += `<div class="header"><img src="images/adapt-icon.png"><h3>Thank you for choosing one of our activities for adaptation!</h3></div>
        <br />
        This is a resource that we believe can be helpful, but currently does include a full lesson plan. We consider this activity to be <b>primed for CS Ed</b> and we believe it could be creatively adapted to fit your classroom needs. You can find the original activity page at the link below.
        <div style="padding-top: 1em">`;
    resource_link += activity_link;
    resource_link += `</div>
            <br />
            If you choose to work with this activity we'd love to collect some information on how it went! This will help us cultivate and improve the activities on this page and assist teachers who want to use this activity in the future. Please <a href="https://www.whitemountainscience.org/resource-table-contact-form">click here</a> to provide us with feedback.
            </div>
        </div>`;
    return resource_link;
}

/*
    Update the options available in a dropdown based on what's in the table
    @private

    TODO: Since this only applies to Subjects now the following two functions could
    be re-written to deal with this one case. 
*/
function _updateSelects(data=resource_table.Activities) {
    _renderSelect("#subject","Subject", data);
}

/*
    Display some text or graphic to show that the resources are still loading
    @param {boolean} loading - indicates whether the loading placeholder is to be
        displayed or not
    @private
*/
// function _displayLoading(loading) {
//     if(loading)
//         $('#load-div').show();
//     else
//         $('#load-div').hide();
// }

